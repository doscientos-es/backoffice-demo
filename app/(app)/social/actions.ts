'use server'

import { defineAction } from '@/lib/actions/define-action'
import {
  AutomationActiveInput,
  AutomationRuleIdInput,
  CreatePostSchema,
  GlobalAutomationInput,
  PostIdInput,
  ReplyCommentInput,
  UpdateScheduledPostInput,
} from '@/lib/schemas/social'
import type { SocialPlatform } from '@/lib/social/core'
import * as repo from '@/lib/social/repo'
import * as service from '@/lib/social/service'

/**
 * Social Hub server actions — thin transport layer.
 *
 * Every action delegates to the application service (lib/social/service), which
 * owns the orchestration. Actions only handle auth (via defineAction roles),
 * validation (Zod schemas) and cache revalidation. Media bytes are uploaded
 * out-of-band through /api/social/upload; these actions receive public URLs.
 */

const WRITE_ROLES = ['owner', 'admin', 'member'] as const

/**
 * Create a composed post and, when `mode === "now"`, publish it immediately.
 * Returns the new post id so the client can navigate to its detail view.
 */
export const createPost = defineAction({
  name: 'social.create',
  schema: CreatePostSchema,
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/dashboard'],
  handler: async (input, { user }) => {
    const postId = await repo.createPost({
      caption: input.caption,
      captions: input.captions as Partial<Record<SocialPlatform, string>> | undefined,
      media: input.media.map((m) => ({ ...m })),
      platforms: input.platforms as SocialPlatform[],
      scheduledAt: input.scheduledAt,
      createdBy: user.id,
      automation: input.automation,
    })
    if (input.mode === 'now') await service.publishPost(postId)
    return { id: postId }
  },
})

/** Publish (or retry) an existing draft/scheduled post. */
export const publishPost = defineAction({
  name: 'social.publish',
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/dashboard'],
  handler: async (input) => {
    const result = await service.publishPost(input.postId)
    return {
      status: result.status as string,
      /** Per-network results so the client can show inline error toasts. */
      targets: result.targets.map((t) => ({
        platform: t.platform as string,
        ok: t.ok,
        error: t.ok ? null : (t.error ?? 'Error desconocido'),
      })),
    }
  },
})

/** Update a scheduled post before the scheduler starts publishing it. */
export const updateScheduledPost = defineAction({
  name: 'social.update-scheduled',
  schema: UpdateScheduledPostInput,
  roles: [...WRITE_ROLES],
  revalidate: (_payload, input) => [
    '/social',
    '/social/dashboard',
    `/social/${input.postId}`,
    `/social/${input.postId}/edit`,
  ],
  handler: async (input) => {
    await repo.updateScheduledPost(input)
  },
})

/** Refresh insights for every published target that supports analytics. */
export const syncInsights = defineAction({
  name: 'social.sync-insights',
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/dashboard'],
  handler: async () => {
    const { synced } = await service.syncInsights()
    return { synced }
  },
})

/** Refresh the unified comment inbox from every published target. */
export const syncComments = defineAction({
  name: 'social.sync-comments',
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social/feed', '/social/feed/inbox'],
  handler: async () => {
    const { synced } = await service.syncComments()
    return { synced }
  },
})

/** Refresh insights and comments for the Social detail view. */
export const syncSocial = defineAction({
  name: 'social.sync-all',
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/feed/inbox'],
  handler: async () => service.syncSocial(),
})

/** Import media that already exists on the connected Instagram account. */
export const importHistoricalInstagram = defineAction({
  name: 'social.import-instagram-history',
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/feed', '/social/feed/inbox'],
  handler: async () => service.importHistoricalInstagramPosts(),
})

/** Delete a post from every social network, then soft-delete locally. */
export const deletePost = defineAction({
  name: 'social.delete',
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/feed'],
  handler: async (input) => {
    // Best-effort remote deletion — failures are logged but never block the local soft-delete.
    await service.deletePostFromNetworks(input.postId)
    await repo.deletePost(input.postId)
  },
})

/**
 * Soft-delete locally + remove media from Supabase storage.
 * Does NOT touch the live posts on any social network.
 */
export const deletePostLocal = defineAction({
  name: 'social.delete_local',
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/feed'],
  handler: async (input) => {
    await service.deletePostLocalWithMedia(input.postId)
  },
})

/** Restore a soft-deleted post (clears deleted_at). */
export const restorePost = defineAction({
  name: 'social.restore',
  schema: PostIdInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social', '/social/feed'],
  handler: async (input) => {
    await repo.restorePost(input.postId)
  },
})

/** Reply to a comment in the unified inbox as the connected organization. */
export const replyToComment = defineAction({
  name: 'social.reply',
  schema: ReplyCommentInput,
  roles: [...WRITE_ROLES],
  revalidate: () => ['/social/feed'],
  handler: async (input) => {
    await service.replyToComment(input.commentId, input.message)
  },
})

/** Create a global fallback automation for Instagram and/or Facebook. */
export const createGlobalAutomationRule = defineAction({
  name: 'social.automation.create-global',
  schema: GlobalAutomationInput,
  roles: [...WRITE_ROLES],
  revalidate: ['/social/automation'],
  handler: async (input, { user }) => {
    await repo.createAutomationRules({ ...input, postId: null, createdBy: user.id })
  },
})

export const setAutomationRuleActive = defineAction({
  name: 'social.automation.toggle',
  schema: AutomationActiveInput,
  roles: [...WRITE_ROLES],
  revalidate: ['/social/automation'],
  handler: async (input) => {
    await repo.setAutomationRuleActive(input.ruleId, input.active)
  },
})

export const deleteAutomationRule = defineAction({
  name: 'social.automation.delete',
  schema: AutomationRuleIdInput,
  roles: ['owner', 'admin'],
  revalidate: ['/social/automation'],
  handler: async (input) => {
    await repo.deleteAutomationRule(input.ruleId)
  },
})
