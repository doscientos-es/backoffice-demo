import { z } from 'zod'

import {
  EXPENSE_CATEGORIES,
  EXPENSE_FORM_DEFAULTS,
  EXPENSE_PAYMENT_SOURCES,
  EXPENSE_RECURRENCES,
  EXPENSE_STATUSES,
} from '@/lib/finance'

import { emptyToUndef, optionalDate, uuidIdInput } from './common'

/**
 * Zod schemas for the `expenses` domain.
 *
 * Re-exports the canonical enums from `lib/finance` so callers only need to
 * touch `lib/schemas/expense` for validation + type derivation.
 */

export { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_SOURCES, EXPENSE_RECURRENCES, EXPENSE_STATUSES }

export const ExpenseCategory = z.enum(EXPENSE_CATEGORIES)
export type ExpenseCategoryType = z.infer<typeof ExpenseCategory>

export const ExpenseStatus = z.enum(EXPENSE_STATUSES)
export type ExpenseStatusType = z.infer<typeof ExpenseStatus>

export const ExpenseRecurrence = z.enum(EXPENSE_RECURRENCES)
export type ExpenseRecurrenceType = z.infer<typeof ExpenseRecurrence>

export const ExpensePaymentSource = z.enum(EXPENSE_PAYMENT_SOURCES)
export type ExpensePaymentSourceType = z.infer<typeof ExpensePaymentSource>

/**
 * Shared field shape for the new-expense / edit-expense forms. Strings come
 * from HTML inputs so we coerce + collapse empty strings to undefined wherever
 * the field is optional. Kept as a bare `z.object` (no refinement) so it can be
 * `.extend`ed for the update schema, mirroring `lib/schemas/project.ts`.
 */
const ExpenseBase = z.object({
  vendor: z.string().min(1, 'El proveedor es obligatorio').max(160),
  description: z.string().max(400).optional().or(emptyToUndef),
  category: ExpenseCategory.default(EXPENSE_FORM_DEFAULTS.category),
  status: ExpenseStatus.default(EXPENSE_FORM_DEFAULTS.status),
  recurrence: ExpenseRecurrence.default(EXPENSE_FORM_DEFAULTS.recurrence),
  expense_date: z.string().min(1, 'La fecha es obligatoria'),
  due_date: optionalDate,
  paid_at: optionalDate,
  currency: z.string().min(3).max(3).default(EXPENSE_FORM_DEFAULTS.currency),
  subtotal: z.coerce.number().min(0, 'El importe debe ser ≥ 0'),
  tax_rate: z.coerce.number().min(0).max(100).default(EXPENSE_FORM_DEFAULTS.tax_rate),
  vendor_nif: z.string().max(20).optional().or(emptyToUndef),
  invoice_reference: z.string().max(80).optional().or(emptyToUndef),
  project_id: z.string().uuid().optional().or(emptyToUndef),
  notes: z.string().max(4000).optional().or(emptyToUndef),
  payment_source: ExpensePaymentSource.default(EXPENSE_FORM_DEFAULTS.payment_source),
  paid_by_member_id: z.string().uuid().optional().or(emptyToUndef),
})

/** A non-company expense must record which partner paid it. */
const hasPayer = (d: z.infer<typeof ExpenseBase>) =>
  d.payment_source === 'company' || !!d.paid_by_member_id
const payerRefinement = {
  message: 'Selecciona el socio que ha pagado este gasto',
  path: ['paid_by_member_id'],
}

/** Create payload, consumed from FormData via `formDataToObject`. */
export const ExpenseInput = ExpenseBase.refine(hasPayer, payerRefinement)
export type ExpenseInputType = z.infer<typeof ExpenseInput>

export const ExpenseIdInput = uuidIdInput

/**
 * Update payload: the create shape plus the row `id`. Validated/coerced by the
 * same rules as `ExpenseInput`, so callers submit raw form values (strings) and
 * the action receives a fully typed object.
 */
export const UpdateExpenseInput = ExpenseBase.extend({
  id: z.string().uuid('ID inválido'),
  expected_version: z.coerce.number().int().positive(),
}).refine(hasPayer, payerRefinement)
export type UpdateExpenseInputType = z.infer<typeof UpdateExpenseInput>
