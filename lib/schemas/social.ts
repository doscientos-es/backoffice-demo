import { z } from 'zod'

import { SOCIAL_PLATFORMS } from '@/lib/social/core'

/**
 * Zod schemas for the Social Hub server actions.
 *
 * Inputs are already-uploaded media (the raw file bytes travel through the
 * `/api/social/upload` route, which returns these MediaItem shapes) plus the
 * composition metadata. Kept aligned with `social_posts` / `social_post_targets`
 * in supabase/migrations and the domain `MediaItem` in lib/social/core.
 */

const platformEnum = z.enum(SOCIAL_PLATFORMS as unknown as [string, ...string[]])

/** One uploaded asset, as returned by the upload route. */
export const MediaItemInput = z.object({
  storagePath: z.string().min(1),
  publicUrl: z.string().url(),
  type: z.enum(['image', 'video']),
  mime: z.string().min(1),
})

/**
 * Compose payload. `mode` decides the lifecycle: publish immediately, schedule
 * for `scheduledAt`, or keep as a draft. Caption may be empty for media-only
 * posts; a post must target at least one network. `captions` is an optional map
 * of per-network copy overrides — any platform omitted inherits `caption`.
 */
export const CreatePostSchema = z
  .object({
    caption: z.string().max(3000, 'El texto no puede superar 3000 caracteres').default(''),
    captions: z
      .record(platformEnum, z.string().max(3000, 'El texto no puede superar 3000 caracteres'))
      .optional(),
    media: z.array(MediaItemInput).max(10, 'Máximo 10 archivos').default([]),
    platforms: z.array(platformEnum).min(1, 'Selecciona al menos una red'),
    mode: z.enum(['now', 'schedule', 'draft']).default('draft'),
    scheduledAt: z.string().datetime().nullable().default(null),
    automation: z
      .object({
        keyword: z.string().trim().min(1).max(80),
        publicReply: z.string().trim().min(1).max(3000),
        privateMessage: z.string().trim().min(1).max(3000),
        platforms: z.array(z.enum(['instagram', 'facebook'])).min(1),
      })
      .optional(),
  })
  .refine((v) => v.mode !== 'schedule' || Boolean(v.scheduledAt), {
    message: 'Indica la fecha de programación',
    path: ['scheduledAt'],
  })

export type CreatePostSchemaType = z.infer<typeof CreatePostSchema>

/** Publish an existing post now. */
export const PostIdInput = z.object({ postId: z.string().uuid() })

/** Update a post while it remains scheduled and has not been published. */
export const UpdateScheduledPostInput = z.object({
  postId: z.string().uuid(),
  caption: z.string().max(3000, 'El texto no puede superar 3000 caracteres'),
  media: z.array(MediaItemInput).max(10, 'Máximo 10 archivos'),
  scheduledAt: z.string().datetime(),
})

/** Reply to a comment in the unified inbox. */
export const ReplyCommentInput = z.object({
  commentId: z.string().uuid(),
  message: z.string().trim().min(1, 'El mensaje no puede estar vacío').max(3000),
})

const metaPlatformEnum = z.enum(['instagram', 'facebook'])

export const AutomationInput = z.object({
  keyword: z.string().trim().min(1, 'Indica la palabra clave').max(80),
  publicReply: z.string().trim().min(1, 'Indica la respuesta pública').max(3000),
  privateMessage: z.string().trim().min(1, 'Indica el mensaje privado').max(3000),
  platforms: z.array(metaPlatformEnum).min(1, 'Selecciona Instagram o Facebook'),
})

export const AutomationRuleIdInput = z.object({ ruleId: z.string().uuid() })

export const AutomationActiveInput = AutomationRuleIdInput.extend({ active: z.boolean() })

export const GlobalAutomationInput = AutomationInput
