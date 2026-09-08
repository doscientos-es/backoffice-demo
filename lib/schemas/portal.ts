import { z } from 'zod'

/**
 * Zod schemas for the public portal access controls shared by proposals and
 * invoices (`is_client_visible` toggle + optional password gate).
 *
 * Kept domain-agnostic because both resources expose the exact same
 * `/p/...` link surface and admin controls.
 */

/** Hex `portal_token` used in `/p/proposal/[token]` and `/p/invoice/[token]`. */
export const PortalToken = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[a-f0-9]+$/i)

/**
 * Admin update of a resource's portal access.
 *
 * Field semantics (each is independent and optional):
 *   * `is_client_visible` omitted → unchanged; boolean → set.
 *   * `password` omitted → unchanged; `null` → clear/remove; non-empty
 *     string → set a new password (hashed server-side).
 */
export const UpdatePortalAccessInput = z.object({
  id: z.string().uuid(),
  is_client_visible: z.boolean().optional(),
  password: z.string().max(200).nullable().optional(),
})
export type UpdatePortalAccessInputType = z.infer<typeof UpdatePortalAccessInput>

/** Visitor-supplied password submitted on the public unlock form. */
export const PortalUnlockInput = z.object({
  token: PortalToken,
  password: z.string().min(1, 'Introduce la contraseña').max(200),
})
export type PortalUnlockInputType = z.infer<typeof PortalUnlockInput>
