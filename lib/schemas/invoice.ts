import { z } from 'zod'

import { lineItemInput, uuidIdInput } from './common'

/**
 * Zod schemas for the `invoices` domain.
 *
 * Covers the CRUD endpoints and Verifactu submission helpers in
 * `app/(app)/invoices/actions.ts`.
 */

export const InvoiceStatus = z.enum([
  'draft',
  'issued',
  'paid',
  'overdue',
  'cancelled',
  'rectified',
])
export type InvoiceStatusType = z.infer<typeof InvoiceStatus>

export const InvoiceIdInput = uuidIdInput

export const SendInvoiceInput = uuidIdInput

/**
 * Input for emailing the public portal link of an invoice to the client.
 * `to` overrides the client's stored email; `message` is an optional note.
 */
export const SendInvoiceEmailInput = z.object({
  id: z.string().uuid(),
  to: z.string().email().optional(),
  message: z.string().max(1000).optional(),
})
export type SendInvoiceEmailInputType = z.infer<typeof SendInvoiceEmailInput>

export const CreateInvoiceFromProposalInput = z.object({
  proposalId: z.string().uuid(),
})
export type CreateInvoiceFromProposalInputType = z.infer<typeof CreateInvoiceFromProposalInput>

/** Creates the missing draft invoices for the proposal's configured payment plan. */
export const CreateInvoicesFromProposalPlanInput = CreateInvoiceFromProposalInput

/**
 * Generate a draft invoice for an hourly project from the hours logged in a
 * given calendar month. `month` is `YYYY-MM`.
 */
export const CreateMonthlyHourlyInvoiceInput = z.object({
  projectId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes no válido (YYYY-MM)'),
})
export type CreateMonthlyHourlyInvoiceInputType = z.infer<typeof CreateMonthlyHourlyInvoiceInput>

export const UpdateInvoiceInput = z.object({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  issue_date: z.string().optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  payment_terms: z.string().max(4000).nullable().optional(),
  items: z.array(lineItemInput).min(1).optional(),
})
export type UpdateInvoiceInputType = z.input<typeof UpdateInvoiceInput>

export const PaymentMethod = z.enum(['transfer', 'card', 'bizum', 'cash', 'other'])
export type PaymentMethodType = z.infer<typeof PaymentMethod>

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  transfer: 'Transferencia bancaria',
  card: 'Tarjeta (Redsys)',
  bizum: 'Bizum',
  cash: 'Efectivo',
  other: 'Otro',
}

export const UpdateInvoiceStatusInput = z.object({
  id: z.string().uuid(),
  status: InvoiceStatus,
  paymentMethod: PaymentMethod.optional(),
})
export type UpdateInvoiceStatusInputType = z.infer<typeof UpdateInvoiceStatusInput>

export const RecordInvoicePaymentInput = z.object({
  id: z.string().uuid(),
  amount: z.coerce.number().finite().positive(),
  paymentMethod: PaymentMethod,
})

export const MarkUncollectibleInput = z.object({
  id: z.string().uuid(),
})
export type MarkUncollectibleInputType = z.infer<typeof MarkUncollectibleInput>

/**
 * Input for creating a rectification invoice (factura rectificativa).
 * Types R1/R4 are the most common for B2B invoices (RD 1619/2012 art.15).
 * R1 = error/devolución; R4 = otras causas.
 */
export const RectificationType = z.enum(['R1', 'R4'])
export type RectificationTypeType = z.infer<typeof RectificationType>

export const CreateRectificationInput = z.object({
  originalInvoiceId: z.string().uuid(),
  rectificationType: RectificationType,
  reason: z.string().min(1, 'El motivo es obligatorio').max(500),
})
export type CreateRectificationInputType = z.infer<typeof CreateRectificationInput>
