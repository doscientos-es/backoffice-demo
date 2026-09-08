import { z } from 'zod'

import { optionalDate, optionalText, optionalUuid, requiredText } from '@/lib/schemas/common'
import { passwordField } from '@/lib/schemas/password'

export const VAULT_SERVICES = [
  'hosting',
  'domain',
  'token',
  'cms',
  'database',
  'api',
  'email',
  'ssh',
  'vpn',
  'other',
] as const

export type VaultService = (typeof VAULT_SERVICES)[number]

export const VAULT_SERVICE_LABELS: Record<VaultService, string> = {
  hosting: 'Hosting',
  domain: 'Dominio',
  token: 'Token',
  cms: 'CMS',
  database: 'Base de datos',
  api: 'API / Token',
  email: 'Email',
  ssh: 'SSH',
  vpn: 'VPN',
  other: 'Otro',
}

export const CreateVaultItemInput = z.object({
  name: requiredText(200, 'Nombre obligatorio'),
  service: z.enum(VAULT_SERVICES).default('other'),
  username: optionalText(500),
  secret: requiredText(10_000, 'El secreto no puede estar vacío'),
  notes: optionalText(2000),
  is_sensitive: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === 'on')
    .or(z.boolean()),
  expires_at: optionalDate,
  client_id: optionalUuid,
})
export type CreateVaultItemInputType = z.infer<typeof CreateVaultItemInput>

export const UpdateVaultItemInput = CreateVaultItemInput.extend({
  id: z.string().uuid(),
  /** Empty string means "keep existing secret" (don't re-encrypt). */
  secret: z
    .string()
    .max(10_000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
})
export type UpdateVaultItemInputType = z.infer<typeof UpdateVaultItemInput>

export const VaultPasswordInput = z.object({
  password: passwordField,
  current_password: z
    .string()
    .optional()
    .or(z.literal('').transform(() => undefined)),
})
export type VaultPasswordInputType = z.infer<typeof VaultPasswordInput>

export const VaultUnlockInput = z.object({
  password: z.string().min(1, 'Introduce la contraseña'),
})

/** Re-authenticates with the master password before enrolling a new passkey. */
export const VaultPasskeyEnrollmentInput = VaultUnlockInput
