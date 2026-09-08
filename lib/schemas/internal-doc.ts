import { z } from 'zod'

import { emptyToUndef, optionalDate, requiredText, uuidIdInput } from './common'

/**
 * Zod schemas for the `internal_documents` domain.
 *
 * Used by both the soft-delete server action and the `/api/internal-docs/upload`
 * route. The enums are exposed as plain arrays for the upload route, which
 * needs to do a manual `includes()` check on raw FormData values.
 */

export const INTERNAL_DOC_CATEGORIES = [
  'legal',
  'hr',
  'finance',
  'templates',
  'policies',
  'meetings',
  'other',
] as const
export type InternalDocCategory = (typeof INTERNAL_DOC_CATEGORIES)[number]

export const INTERNAL_DOC_VISIBILITIES = ['all_team', 'admins_only'] as const
export type InternalDocVisibility = (typeof INTERNAL_DOC_VISIBILITIES)[number]

export const InternalDocCategorySchema = z.enum(INTERNAL_DOC_CATEGORIES)
export const InternalDocVisibilitySchema = z.enum(INTERNAL_DOC_VISIBILITIES)

export const InternalDocIdInput = uuidIdInput

/** Max upload size enforced by the upload route (50 MB). */
export const INTERNAL_DOC_MAX_SIZE_BYTES = 50 * 1024 * 1024

/** Max number of tags and per-tag length. */
export const INTERNAL_DOC_MAX_TAGS = 20
export const INTERNAL_DOC_MAX_TAG_LENGTH = 40

/**
 * Auditable actions recorded in `internal_document_events`. Kept in sync with
 * the CHECK constraint in the migration.
 */
export const INTERNAL_DOC_ACTIONS = ['created', 'updated', 'file_replaced', 'deleted'] as const
export type InternalDocAction = (typeof INTERNAL_DOC_ACTIONS)[number]

/**
 * Input for editing an internal document's metadata. The file itself is
 * replaced through `/api/internal-docs/[id]/replace`, not via this action.
 */
export const UpdateInternalDocInput = z.object({
  id: z.string().uuid(),
  name: requiredText(200, 'El nombre es obligatorio'),
  description: z.string().max(2000).optional().or(emptyToUndef),
  category: InternalDocCategorySchema,
  visibility: InternalDocVisibilitySchema,
  tags: z
    .array(z.string().trim().min(1).max(INTERNAL_DOC_MAX_TAG_LENGTH))
    .max(INTERNAL_DOC_MAX_TAGS, `Máximo ${INTERNAL_DOC_MAX_TAGS} etiquetas`)
    .default([]),
  effective_date: optionalDate,
  expires_at: optionalDate,
})
export type UpdateInternalDocInputType = z.infer<typeof UpdateInternalDocInput>
