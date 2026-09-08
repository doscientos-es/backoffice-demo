import { z } from 'zod'

import { BILLING_CYCLES } from '@/lib/finance/helpers'

/**
 * Shared Zod primitives used across server action schemas.
 *
 * The HTML forms in this app submit empty strings for unfilled optional
 * fields. These helpers normalise that "" → undefined coercion in one place
 * so individual schemas don't have to repeat the `.or(z.literal(""))` dance.
 */

/** Coerces an empty string to `undefined`. */
export const emptyToUndef = z.literal('').transform(() => undefined)

/** Optional UUID. Accepts "" and treats it as undefined. */
export const optionalUuid = z.string().uuid().optional().or(emptyToUndef)

/**
 * Assignable UUID for nullable foreign keys (e.g. an owner/assignee).
 * Accepts a UUID, `null`, or "" — coercing "" to `null` so an empty
 * `<select>` clears the relation instead of leaving it untouched.
 */
export const assignableUuid = z
  .string()
  .uuid()
  .nullable()
  .or(z.literal('').transform(() => null))

/**
 * Optional ISO date string (YYYY-MM-DD or full ISO). Collapses "" → undefined
 * so empty `<input type="date">` values never reach a `date` column (which
 * would raise `invalid input syntax for type date: ""`).
 *
 * Note: we must transform here rather than `z.string().optional().or(emptyToUndef)`,
 * because `z.string()` happily accepts "" and short-circuits the union.
 */
export const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

/** Optional email. Accepts "" and treats it as undefined. */
export const optionalEmail = z.string().email('Email no válido').optional().or(emptyToUndef)

/** Builds an optional text field with a max length, treating "" as undefined. */
export function optionalText(max: number, message?: string) {
  const base = message ? z.string().max(max, message) : z.string().max(max)
  return base.optional().or(emptyToUndef)
}

/** Required, trimmed, non-empty string with a max length. */
export function requiredText(max: number, requiredMessage: string) {
  return z.string().trim().min(1, requiredMessage).max(max)
}

/** Convert a `FormData` to a plain `Record<string, string>`. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/** Reusable `{ id: uuid }` payload shape, used by many delete/toggle actions. */
export const uuidIdInput = z.object({ id: z.string().uuid() })

/**
 * Validation schema for an editable finance line item (proposals + invoices).
 * Lives here because both domains share the exact same shape and error
 * messages; centralising it avoids drift between proposal and invoice forms.
 */
export const lineItemInput = z.object({
  description: z.string().min(1, 'Descripción obligatoria').max(500),
  quantity: z.coerce.number().positive('Cantidad > 0'),
  unit_price: z.coerce.number().nonnegative('Precio ≥ 0'),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
  /**
   * Billing cadence. Only persisted for proposal items; invoice actions
   * accept the field for shape parity but ignore it on write.
   */
  billing_cycle: z.enum(BILLING_CYCLES).default('none'),
})
export type LineItemInputType = z.infer<typeof lineItemInput>
