import { z } from 'zod'

import { optionalEmail, optionalText, requiredText } from './common'

/**
 * Zod schemas for the `clients` domain.
 *
 * Re-used by server actions and API routes. Keep the shape aligned with the
 * `clients` table in supabase/migrations; fields here are the user-supplied
 * inputs, NOT the full DB row.
 */

export const CreateClientInput = z.object({
  name: requiredText(160, 'El nombre es obligatorio'),
  /** Short display name shown in lists. Falls back to `name` when absent. */
  label: optionalText(100),
  nif: optionalText(20),
  email: optionalEmail,
  phone: optionalText(40),
  // Structured billing address — each part stored separately.
  billing_address_street: optionalText(200),
  billing_address_zip: optionalText(20),
  billing_address_city: optionalText(100),
  billing_address_province: optionalText(100),
  billing_address_country: optionalText(10).default('ES'),
  contact_person: optionalText(160),
  notes: optionalText(4000),
  /** Public URL of the client logo stored in Supabase Storage. Optional. */
  logo_url: optionalText(500),
})

export type CreateClientInputType = z.infer<typeof CreateClientInput>

export const UpdateClientInput = CreateClientInput.extend({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
})

export type UpdateClientInputType = z.infer<typeof UpdateClientInput>

export const ValidateClientFiscalIdentityInput = z.object({
  clientId: z.string().uuid(),
})
