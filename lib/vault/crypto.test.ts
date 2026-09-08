import { beforeEach, describe, expect, it, vi } from 'vitest'

const { env, serverEnv } = vi.hoisted(() => {
  const env = {
    VAULT_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-aaaaaaaaaaaaaaaa',
  }
  return { env, serverEnv: vi.fn(() => env) }
})

vi.mock('@/lib/env', () => ({ serverEnv }))

import { decryptSecret, encryptSecret } from './crypto'

describe('vault crypto', () => {
  beforeEach(() => {
    env.VAULT_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64')
  })

  it('uses the validated environment key to round-trip a secret', () => {
    const ciphertext = encryptSecret('vault secret')

    expect(ciphertext).not.toContain('vault secret')
    expect(decryptSecret(ciphertext)).toBe('vault secret')
    expect(serverEnv).toHaveBeenCalled()
  })

  it('reads secrets written before a dedicated encryption key was configured', () => {
    env.VAULT_ENCRYPTION_KEY = ''
    const legacyCiphertext = encryptSecret('legacy vault secret')
    env.VAULT_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64')

    expect(decryptSecret(legacyCiphertext)).toBe('legacy vault secret')
  })

  it('does not expose OpenSSL authentication errors for unavailable keys', () => {
    const ciphertext = encryptSecret('vault secret')
    env.VAULT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

    expect(() => decryptSecret(ciphertext)).toThrow(/No se pudo descifrar el secreto/)
  })
})
