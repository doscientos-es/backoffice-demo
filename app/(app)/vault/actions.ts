'use server'

import { defineAction } from '@/lib/actions/define-action'
import { requireRole } from '@/lib/auth'
import { uuidIdInput } from '@/lib/schemas/common'
import {
  CreateVaultItemInput,
  UpdateVaultItemInput,
  VaultPasskeyEnrollmentInput,
  VaultPasswordInput,
  VaultUnlockInput,
} from '@/lib/schemas/vault'
import { consumeUserVerification } from '@/lib/security/user-verification'
import { userVerificationScope } from '@/lib/security/user-verification-scope'
import { createPasskeyRegistrationOptions } from '@/lib/security/webauthn'
import { createServerClient } from '@/lib/supabase/server'
import {
  grantVaultUnlock,
  hashVaultPassword,
  isVaultUnlocked,
  revokeVaultUnlock,
  verifyVaultPassword,
} from '@/lib/vault/access'
import { decryptSecret, encryptSecret } from '@/lib/vault/crypto'

// ── helpers ──────────────────────────────────────────────────────────────────

async function getVaultPasswordHash(): Promise<string | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('settings')
    .select('vault_password_hash')
    .eq('id', 1)
    .single()
  return (data as { vault_password_hash: string | null } | null)?.vault_password_hash ?? null
}

// ── actions ───────────────────────────────────────────────────────────────────

export const createVaultItem = defineAction({
  name: 'vault.create',
  schema: CreateVaultItemInput,
  revalidate: () => ['/vault'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase.from('vault_items').insert({
      name: input.name,
      service: input.service,
      username: input.username ?? null,
      secret_encrypted: encryptSecret(input.secret),
      notes: input.notes ?? null,
      is_sensitive: input.is_sensitive ?? true,
      expires_at: input.expires_at ?? null,
      client_id: input.client_id ?? null,
    })
    if (error) throw new Error(error.message)
  },
})

export const updateVaultItem = defineAction({
  name: 'vault.update',
  schema: UpdateVaultItemInput,
  revalidate: () => ['/vault'],
  handler: async (input) => {
    await requireRole(['owner', 'admin'])
    const supabase = await createServerClient()

    // If the stored item is sensitive, the vault must be unlocked.
    const { data: current } = await supabase
      .from('vault_items')
      .select('is_sensitive')
      .eq('id', input.id)
      .is('deleted_at', null)
      .single()
    if ((current as { is_sensitive: boolean } | null)?.is_sensitive) {
      const hash = await getVaultPasswordHash()
      if (!(await isVaultUnlocked(hash))) {
        throw new Error('Desbloquea la bóveda para editar este secreto sensible')
      }
    }

    const patch: Record<string, unknown> = {
      name: input.name,
      service: input.service,
      username: input.username ?? null,
      notes: input.notes ?? null,
      is_sensitive: input.is_sensitive ?? true,
      expires_at: input.expires_at ?? null,
      client_id: input.client_id ?? null,
      updated_at: new Date().toISOString(),
    }
    if (input.secret) patch.secret_encrypted = encryptSecret(input.secret)
    const { error } = await supabase.from('vault_items').update(patch).eq('id', input.id)
    if (error) throw new Error(error.message)
  },
})

export const deleteVaultItem = defineAction({
  name: 'vault.delete',
  schema: uuidIdInput,
  revalidate: () => ['/vault'],
  handler: async (input) => {
    await requireRole(['owner', 'admin'])
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('vault_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)
    if (error) throw new Error(error.message)
  },
})

export const unlockVault = defineAction({
  name: 'vault.unlock',
  schema: VaultUnlockInput,
  handler: async (input) => {
    const hash = await getVaultPasswordHash()
    if (!hash) return // no password set
    if (!verifyVaultPassword(input.password, hash)) throw new Error('Contraseña incorrecta')
    await grantVaultUnlock(hash)
  },
})

/** Starts passkey enrollment only after an explicit master-password check. */
export const beginVaultPasskeyRegistration = defineAction({
  name: 'vault.passkey.beginRegistration',
  schema: VaultPasskeyEnrollmentInput,
  handler: async (input, { user }) => {
    const hash = await getVaultPasswordHash()
    if (!hash || !verifyVaultPassword(input.password, hash)) {
      throw new Error('Contraseña maestra incorrecta')
    }
    return { options: await createPasskeyRegistrationOptions(user) }
  },
})

/** Consumes one WebAuthn proof and creates the normal four-hour vault grant. */
export const unlockVaultWithPasskey = defineAction({
  name: 'vault.unlockWithPasskey',
  handler: async (_input, { user }) => {
    const hash = await getVaultPasswordHash()
    if (!hash) throw new Error('Configura primero una contraseña maestra')
    await consumeUserVerification(user.id, userVerificationScope('vault.unlock', 'vault'))
    await grantVaultUnlock(hash)
  },
})

export const lockVault = defineAction({
  name: 'vault.lock',
  handler: async () => {
    await revokeVaultUnlock()
  },
})

export const setVaultPassword = defineAction({
  name: 'vault.setPassword',
  schema: VaultPasswordInput,
  revalidate: () => ['/vault'],
  handler: async (input) => {
    const existingHash = await getVaultPasswordHash()
    if (existingHash) {
      if (!input.current_password) throw new Error('Introduce la contraseña actual')
      if (!verifyVaultPassword(input.current_password, existingHash))
        throw new Error('Contraseña actual incorrecta')
    }
    const newHash = hashVaultPassword(input.password)
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('settings')
      .update({ vault_password_hash: newHash })
      .eq('id', 1)
    if (error) throw new Error(error.message)
    await grantVaultUnlock(newHash)
  },
})

export const revealVaultSecret = defineAction({
  name: 'vault.reveal',
  schema: uuidIdInput,
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('vault_items')
      .select('secret_encrypted, is_sensitive')
      .eq('id', input.id)
      .is('deleted_at', null)
      .single()
    if (error || !data) throw new Error('Item no encontrado')
    const row = data as { secret_encrypted: string; is_sensitive: boolean }

    // The unlock gate is decided from the STORED sensitivity flag, never from a
    // client-supplied value. Trusting client input here was an IDOR/broken
    // access-control vector: any caller could pass is_sensitive=false and
    // decrypt a sensitive secret without unlocking the vault.
    if (row.is_sensitive) {
      const hash = await getVaultPasswordHash()
      if (!(await isVaultUnlocked(hash))) {
        throw new Error('Desbloquea la bóveda para ver este secreto')
      }
    }

    return { secret: decryptSecret(row.secret_encrypted) }
  },
})
