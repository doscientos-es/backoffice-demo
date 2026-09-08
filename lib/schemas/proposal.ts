import { z } from 'zod'

import { KEY_POINTS_LIMITS } from '@/lib/proposals/key-points'
import { maintenanceOfferInput } from '@/lib/proposals/maintenance'
import { paymentPlanInput, paymentScheduleInput, scopeModulesInput } from '@/lib/proposals/scope'

import {
  emptyToUndef,
  lineItemInput,
  optionalEmail,
  optionalText,
  optionalUuid,
  requiredText,
  uuidIdInput,
} from './common'

/**
 * Shape of a single problem/solution narrative bullet. The id is generated
 * client-side and persisted as-is so the deck/portal can use it as a React
 * key without re-deriving it on every render.
 */
export const keyPointInput = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1, 'Título obligatorio').max(KEY_POINTS_LIMITS.maxTitleLength),
  description: z.string().max(KEY_POINTS_LIMITS.maxDescriptionLength).nullable().optional(),
})
export type KeyPointInputType = z.infer<typeof keyPointInput>

/** Reusable, nullable list of key points capped at the domain limit. */
const keyPointListField = z
  .array(keyPointInput)
  .max(KEY_POINTS_LIMITS.maxCount)
  .nullable()
  .optional()

const proposalMarkdownField = (maxLength: number) =>
  z
    .string()
    .max(maxLength)
    .optional()
    .or(z.literal('').transform(() => null))
    .nullable()

/**
 * Zod schemas for the `proposals` domain.
 *
 * Covers proposal CRUD (used by both the FormData and JSON entry points in
 * `app/(app)/proposals/actions.ts`), proposal specs (`spec-actions.ts`) and
 * the public portal token transitions (`app/p/proposal/[token]/actions.ts`).
 */

// ---------------- Proposals ----------------

/**
 * A proposal must target exactly one of (client_id, lead_id). Project
 * association is optional: link an existing project when the proposal
 * extends ongoing work. Drafts authored against a lead get upgraded to a
 * client at acceptance time via the portal fiscal form.
 */
export const CreateProposalInput = z
  .object({
    client_id: optionalUuid,
    lead_id: optionalUuid,
    project_id: optionalUuid,
    title: z.string().min(1, 'Título obligatorio').max(200),
    valid_until: z.string().optional().or(emptyToUndef),
    notes: z.string().max(4000).optional(),
    items: z.array(lineItemInput).min(1, 'Añade al menos una línea'),
  })
  .refine((v) => Boolean(v.client_id) !== Boolean(v.lead_id), {
    message: 'Selecciona un cliente o un lead',
    path: ['client_id'],
  })
export type CreateProposalInputType = z.infer<typeof CreateProposalInput>

/**
 * Action to clone an existing proposal as a new draft. The clone resets
 * status, portal token, number, timestamps and signature data, but keeps
 * the title (prefixed), target, narrative blocks and line items.
 */
export const DuplicateProposalInput = uuidIdInput
export type DuplicateProposalInputType = z.infer<typeof DuplicateProposalInput>

/**
 * Patch payload for the inline editor + autosave. All fields optional except
 * `id`; nullable string fields collapse "" → null so the editor can clear
 * them. When `items` is present the entire line set is replaced atomically.
 */
export const UpdateProposalInput = z.object({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  valid_until: z
    .string()
    .optional()
    .or(z.literal('').transform(() => null))
    .nullable(),
  notes: proposalMarkdownField(4_000),
  context_markdown: proposalMarkdownField(20_000),
  problems: keyPointListField,
  solutions: keyPointListField,
  terms: proposalMarkdownField(20_000),
  scope_modules: scopeModulesInput.nullable().optional(),
  deliverables: proposalMarkdownField(20_000),
  acceptance_criteria: proposalMarkdownField(20_000),
  payment_schedule: paymentScheduleInput.optional(),
  payment_plan: paymentPlanInput.optional(),
  payment_terms: proposalMarkdownField(8_000),
  change_management_terms: proposalMarkdownField(8_000),
  maintenance_options: maintenanceOfferInput.nullable().optional(),
  maintenance_selected_plan_id: z.string().min(1).max(64).nullable().optional(),
  items: z.array(lineItemInput).min(1).optional(),
})
export type UpdateProposalInputType = z.infer<typeof UpdateProposalInput>

/** Calendar-only update allowed after acceptance for unbilled future payments. */
export const UpdateProposalPaymentPlanInput = z.object({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  payment_plan: paymentPlanInput,
})

export const UpdateProposalTeamInput = z.object({
  proposal_id: z.string().uuid(),
  member_ids: z.array(z.string().uuid()).max(20),
})
export type UpdateProposalTeamInputType = z.infer<typeof UpdateProposalTeamInput>

export const SendProposalPreviewInput = z.object({
  id: z.string().uuid(),
  to: z.string().email().optional(),
  message: z.string().max(1000).optional(),
})
export type SendProposalPreviewInputType = z.infer<typeof SendProposalPreviewInput>

// ---------------- Proposal specs ----------------

export const CreateProposalSpecInput = z.object({
  proposal_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body_markdown: z.string().min(1).max(60_000),
  is_client_visible: z.boolean().default(false),
})
export type CreateProposalSpecInputType = z.infer<typeof CreateProposalSpecInput>

export const UpdateProposalSpecInput = z.object({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  body_markdown: z.string().min(1).max(60_000).optional(),
})
export type UpdateProposalSpecInputType = z.infer<typeof UpdateProposalSpecInput>

export const ToggleProposalSpecVisibilityInput = z.object({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  is_client_visible: z.boolean(),
})
export type ToggleProposalSpecVisibilityInputType = z.infer<
  typeof ToggleProposalSpecVisibilityInput
>

export const ProposalSpecIdInput = uuidIdInput

// ---------------- Public portal (token-scoped) ----------------

/**
 * Hex token used in `/p/proposal/[token]`. Length matches the random_bytes
 * size used when generating portal_token on the server.
 */
export const ProposalPortalToken = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[a-f0-9]+$/i)

export const ProposalRejectionReason = z.string().max(500).optional()

/**
 * Fiscal data the lead must provide on the portal before they can accept
 * a proposal. Mirrors the shape of `ConvertLeadInput` so we can promote
 * the lead to a client in a single transactional acceptance.
 */
export const AcceptProposalFiscalData = z.object({
  name: requiredText(160, 'La razón social es obligatoria'),
  nif: requiredText(20, 'El NIF es obligatorio'),
  billing_address: requiredText(400, 'La dirección de facturación es obligatoria'),
  contact_person: optionalText(160),
  email: optionalEmail,
  phone: optionalText(40),
})
export type AcceptProposalFiscalDataType = z.infer<typeof AcceptProposalFiscalData>

export const AcceptProposalInput = z.object({
  token: ProposalPortalToken,
  fiscal: AcceptProposalFiscalData.optional(),
})
export type AcceptProposalInputType = z.infer<typeof AcceptProposalInput>
