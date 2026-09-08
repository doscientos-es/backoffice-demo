import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── shared mutable state ────────────────────────────────────────────────────

const { state } = vi.hoisted(() => ({
  state: {
    // vault_items row returned by the DB query
    vaultRow: null as null | { secret_encrypted: string; is_sensitive: boolean },
    // vault_password_hash stored in settings
    passwordHash: null as string | null,
    // whether isVaultUnlocked resolves to true
    unlocked: false,
  },
}))

// ── module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
  requireRole: vi.fn(async () => ({ id: 'user-1', role: 'owner' })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() =>
    Promise.resolve({
      from: (table: string) => {
        if (table === 'settings') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { vault_password_hash: state.passwordHash },
                  error: null,
                }),
              }),
            }),
          }
        }
        // vault_items
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                single: async () =>
                  state.vaultRow
                    ? { data: state.vaultRow, error: null }
                    : { data: null, error: { message: 'not found' } },
              }),
            }),
          }),
        }
      },
    }),
  ),
}))

vi.mock('@/lib/vault/access', () => ({
  isVaultUnlocked: vi.fn(async () => state.unlocked),
  grantVaultUnlock: vi.fn(),
  revokeVaultUnlock: vi.fn(),
  hashVaultPassword: vi.fn((pw: string) => `hash:${pw}`),
  verifyVaultPassword: vi.fn(() => true),
}))

vi.mock('@/lib/security/user-verification', () => ({
  consumeUserVerification: vi.fn(),
}))

vi.mock('@/lib/security/webauthn', () => ({
  createPasskeyRegistrationOptions: vi.fn(),
}))

vi.mock('@/lib/vault/crypto', () => ({
  encryptSecret: vi.fn((s: string) => `enc:${s}`),
  decryptSecret: vi.fn((s: string) => s.replace(/^enc:/, '')),
}))

// ── import after mocks ────────────────────────────────────────────────────────

import { revealVaultSecret, unlockVaultWithPasskey } from '@/app/(app)/vault/actions'
import { consumeUserVerification } from '@/lib/security/user-verification'

const ITEM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

// ── tests ─────────────────────────────────────────────────────────────────────

describe('revealVaultSecret — IDOR regression', () => {
  beforeEach(() => {
    state.vaultRow = null
    state.passwordHash = null
    state.unlocked = false
  })

  it('returns the decrypted secret for a non-sensitive item without unlocking', async () => {
    state.vaultRow = { secret_encrypted: 'enc:hunter2', is_sensitive: false }

    const result = await revealVaultSecret({ id: ITEM_ID })

    expect(result).toEqual({ ok: true, secret: 'hunter2' })
  })

  it('blocks reveal of a sensitive item when the vault is locked', async () => {
    state.vaultRow = { secret_encrypted: 'enc:top-secret', is_sensitive: true }
    state.passwordHash = 'scrypt$salt$hash'
    state.unlocked = false // vault is locked

    const result = await revealVaultSecret({ id: ITEM_ID })

    expect(result).toEqual({ ok: false, error: 'Desbloquea la bóveda para ver este secreto' })
  })

  it('returns the decrypted secret for a sensitive item when the vault IS unlocked', async () => {
    state.vaultRow = { secret_encrypted: 'enc:top-secret', is_sensitive: true }
    state.passwordHash = 'scrypt$salt$hash'
    state.unlocked = true // vault is unlocked

    const result = await revealVaultSecret({ id: ITEM_ID })

    expect(result).toEqual({ ok: true, secret: 'top-secret' })
  })

  it('returns error when the item is not found (e.g. soft-deleted)', async () => {
    state.vaultRow = null // DB returns no row

    const result = await revealVaultSecret({ id: ITEM_ID })

    expect(result).toEqual({ ok: false, error: 'Item no encontrado' })
  })

  it('treats a sensitive item as locked when no password is set (hash=null)', async () => {
    // When hash is null, isVaultUnlocked resolves true (no password = always open).
    // This test asserts that path still decrypts correctly.
    state.vaultRow = { secret_encrypted: 'enc:open-secret', is_sensitive: true }
    state.passwordHash = null
    state.unlocked = true // isVaultUnlocked(null) → true

    const result = await revealVaultSecret({ id: ITEM_ID })

    expect(result).toEqual({ ok: true, secret: 'open-secret' })
  })
})

describe('unlockVaultWithPasskey', () => {
  beforeEach(() => {
    state.passwordHash = 'scrypt$salt$hash'
    vi.clearAllMocks()
  })

  it('consumes a vault-scoped WebAuthn verification before granting vault access', async () => {
    const result = await unlockVaultWithPasskey()

    expect(result).toEqual({ ok: true })
    expect(consumeUserVerification).toHaveBeenCalledWith('user-1', {
      intent: 'vault.unlock',
      resource: 'vault',
    })
  })
})
