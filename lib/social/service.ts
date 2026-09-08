/**
 * Social Hub — application service.
 *
 * Orchestrates the domain (registry + fan-out) with infrastructure (repository)
 * behind a small use-case API that server actions call. This is the only place
 * that knows how publishing, insight sync, comment sync and replies compose;
 * actions stay thin and the domain stays pure.
 */
import { scopedLogger } from '@/lib/logger'
import type {
  CaptionByPlatform,
  FanOutResult,
  MediaItem,
  PublisherRegistry,
  SocialPlatform,
} from '@/lib/social/core'
import {
  canDeleteRemote,
  canFetchComments,
  canFetchInsights,
  canReply,
  composePost,
  fanOutPublish,
} from '@/lib/social/core'
import { metaPageToken } from '@/lib/social/meta/graph-client'
import { getAccountMedia, type InstagramMedia, igUserId } from '@/lib/social/meta/instagram-api'
import { socialRegistry } from '@/lib/social/registry'
import * as repo from '@/lib/social/repo'
import { removeMedia } from '@/lib/social/storage'
import type { PostDetail, TargetWithInsights } from '@/lib/social/types'

const log = scopedLogger('social-service')

/** Networks with a registered adapter that is configured (safe to target). */
export function availablePlatforms(): SocialPlatform[] {
  return socialRegistry().available()
}

function toMediaItem(media: InstagramMedia): MediaItem | null {
  const publicUrl = media.media_url ?? media.thumbnail_url
  if (!publicUrl) return null
  const type = media.media_type === 'VIDEO' || media.media_type === 'REELS' ? 'video' : 'image'
  return {
    storagePath: '',
    publicUrl,
    type,
    mime: type === 'video' ? 'video/mp4' : 'image/jpeg',
  }
}

/** Map a Graph media object to the local post shape without making network calls. */
export function mapInstagramMedia(media: InstagramMedia): repo.ImportedInstagramPost {
  const source =
    media.media_type === 'CAROUSEL_ALBUM' && media.children?.data?.length
      ? media.children.data
      : [media]
  return {
    remoteId: media.id,
    remoteUrl: media.permalink ?? null,
    caption: media.caption ?? '',
    media: source.map(toMediaItem).filter((item): item is MediaItem => item !== null),
    publishedAt: media.timestamp ?? null,
  }
}

/** Import all media available from Instagram, preserving existing remote posts. */
export async function importHistoricalInstagramPosts(): Promise<{
  total: number
  imported: number
  skipped: number
  failed: number
}> {
  if (!metaPageToken() || !igUserId()) {
    throw new Error('Instagram no está configurado.')
  }

  const media = await getAccountMedia()
  let imported = 0
  let skipped = 0
  let failed = 0
  for (const item of media) {
    try {
      const result = await repo.importInstagramPost(mapInstagramMedia(item))
      if (result === 'imported') imported += 1
      else skipped += 1
    } catch (err) {
      failed += 1
      log.warn({ remoteId: item.id, err: String(err) }, 'instagram_historical_import_failed')
    }
  }
  return { total: media.length, imported, skipped, failed }
}

/**
 * Publish an existing draft/scheduled post to its pending targets, or retry
 * only the targets that previously failed. Targets already `published` are
 * skipped so retrying a partially-failed post never republishes to networks that already
 * succeeded. Marks the post `publishing`, fans out, then persists the
 * per-target outcome.
 */
export async function publishPost(postId: string): Promise<FanOutResult> {
  if (!(await repo.markPublishing(postId))) {
    throw new Error('La publicación ya no está disponible para publicar.')
  }
  // Read after claiming the post, so editing can neither race a publication nor
  // cause the publisher to use an earlier version of its media.
  const post = await repo.getPost(postId)
  if (!post) throw new Error('El post no existe.')
  const pendingTargets = post.targets.filter((t) => t.status !== 'published')
  const platforms = pendingTargets.map((t) => t.platform)
  if (platforms.length === 0) throw new Error('El post no tiene ninguna red seleccionada.')

  const composed = composePost(post.id, post.caption, post.media)
  const captions = captionOverrides(post.targets)
  const result = await fanOutPublish(composed, platforms, socialRegistry(), captions)
  await repo.applyFanOut(postId, result)
  return result
}

/** Publish a bounded batch of scheduled posts whose date has arrived. */
export async function publishDueScheduledPosts(now = new Date()): Promise<{
  checked: number
  published: number
  partiallyFailed: number
  failed: number
  skipped: number
}> {
  const nowIso = now.toISOString()
  const postIds = await repo.listDueScheduledPostIds(nowIso)
  const results = await Promise.allSettled(
    postIds.map((postId) => publishDueScheduledPost(postId, nowIso)),
  )
  let published = 0
  let partiallyFailed = 0
  let failed = 0
  let skipped = 0

  for (const result of results) {
    if (result.status === 'rejected') {
      failed += 1
      log.error({ err: result.reason }, 'scheduled_post_publish_failed')
      continue
    }
    if (result.value === 'skipped') skipped += 1
    else if (result.value === 'published') published += 1
    else if (result.value === 'partially_failed') partiallyFailed += 1
    else failed += 1
  }

  return { checked: postIds.length, published, partiallyFailed, failed, skipped }
}

async function publishDueScheduledPost(
  postId: string,
  nowIso: string,
): Promise<'published' | 'partially_failed' | 'failed' | 'skipped'> {
  if (!(await repo.claimDueScheduledPost(postId, nowIso))) return 'skipped'
  const post = await repo.getScheduledPostForPublishing(postId)
  if (!post) throw new Error('La publicación programada no existe.')

  const platforms = post.targets
    .filter((target) => target.status !== 'published')
    .map((target) => target.platform)
  if (platforms.length === 0) {
    await repo.applyFanOut(postId, { status: 'failed', targets: [] }, true)
    return 'failed'
  }

  const result = await fanOutPublish(
    composePost(post.id, post.caption, post.media),
    platforms,
    socialRegistry(),
    captionOverrides(post.targets),
  )
  await repo.applyFanOut(postId, result, true)
  return result.status === 'published' || result.status === 'partially_failed'
    ? result.status
    : 'failed'
}

/** Collect the per-network copy overrides stored on the post's targets. */
function captionOverrides(targets: { platform: SocialPlatform; caption: string | null }[]) {
  const captions: CaptionByPlatform = {}
  for (const t of targets) {
    if (t.caption !== null) captions[t.platform] = t.caption
  }
  return captions
}

/** Fetch a post with its per-target insights merged in for the analytics view. */
export async function getPostDetail(postId: string): Promise<PostDetail | null> {
  const post = await repo.getPost(postId)
  if (!post) return null
  const targetIds = post.targets.map((t) => t.id)
  const [insightsByTarget, comments] = await Promise.all([
    repo.getInsightsByTarget(targetIds),
    repo.listCommentsForTargets(targetIds),
  ])
  const targets: TargetWithInsights[] = post.targets.map((t) => ({
    ...t,
    insights: insightsByTarget.get(t.id) ?? null,
  }))
  return { ...post, targets, comments }
}

/**
 * Refresh insights for every published target whose Publisher supports it.
 * Errors on one target are logged and skipped so the sweep always completes.
 */
export async function syncInsights(): Promise<{ synced: number }> {
  const registry = socialRegistry()
  const targets = await repo.listPublishedTargets()
  const results = await Promise.all(targets.map((target) => syncTargetInsights(target, registry)))
  return { synced: results.filter(Boolean).length }
}

/**
 * Refresh comments for every published target whose Publisher supports it.
 * Same isolation guarantee as {@link syncInsights}.
 */
export async function syncComments(): Promise<{ synced: number }> {
  const registry = socialRegistry()
  const targets = await repo.listPublishedTargets()
  const results = await Promise.all(targets.map((target) => syncTargetComments(target, registry)))
  return { synced: results.filter(Boolean).length }
}

/** Refresh both analytics and comments in one pass for the Social detail view. */
export async function syncSocial(): Promise<{
  insightsSynced: number
  commentsSynced: number
}> {
  const registry = socialRegistry()
  const targets = await repo.listPublishedTargets()
  const results = await Promise.all(
    targets.map(async (target) => {
      const [insights, comments] = await Promise.all([
        syncTargetInsights(target, registry),
        syncTargetComments(target, registry),
      ])
      return { insights, comments }
    }),
  )
  return {
    insightsSynced: results.filter((result) => result.insights).length,
    commentsSynced: results.filter((result) => result.comments).length,
  }
}

async function syncTargetInsights(
  target: repo.PublishedTarget,
  registry: PublisherRegistry,
): Promise<boolean> {
  if (!registry.isAvailable(target.platform)) return false
  const publisher = registry.get(target.platform)
  if (!canFetchInsights(publisher)) return false
  try {
    const insights = await publisher.fetchInsights(target.remoteId)
    await repo.upsertInsights(target.id, insights)
    return true
  } catch (err) {
    log.warn({ target: target.id, err: String(err) }, 'sync_insights_target_failed')
    return false
  }
}

async function syncTargetComments(
  target: repo.PublishedTarget,
  registry: PublisherRegistry,
): Promise<boolean> {
  if (!registry.isAvailable(target.platform)) return false
  const publisher = registry.get(target.platform)
  if (!canFetchComments(publisher)) return false
  try {
    const comments = await publisher.fetchComments(target.remoteId)
    await repo.upsertComments(target.id, target.platform, comments)
    return true
  } catch (err) {
    log.warn({ target: target.id, err: String(err) }, 'sync_comments_target_failed')
    return false
  }
}

/**
 * Delete a post from every network where it was published successfully.
 * Best-effort: failures on one target are logged but never block the local
 * soft-delete or the other targets.
 */
export async function deletePostFromNetworks(postId: string): Promise<void> {
  const registry = socialRegistry()
  const targets = await repo.getPublishedTargetsForPost(postId)
  await Promise.allSettled(
    targets.map(async (target) => {
      if (!registry.isAvailable(target.platform)) return
      const publisher = registry.get(target.platform)
      if (!canDeleteRemote(publisher)) return
      try {
        await publisher.deletePost(target.remoteId)
        log.info({ postId, platform: target.platform }, 'remote_post_deleted')
      } catch (err) {
        log.warn({ postId, platform: target.platform, err: String(err) }, 'remote_delete_failed')
      }
    }),
  )
}

/**
 * Soft-delete a post locally and remove its Supabase media files.
 * Does NOT touch the live posts on any social network.
 */
export async function deletePostLocalWithMedia(postId: string): Promise<void> {
  const post = await repo.getPost(postId)
  await repo.deletePost(postId)
  if (post) {
    const paths = post.media.map((m) => m.storagePath).filter(Boolean)
    if (paths.length) removeMedia(paths).catch(() => {})
  }
}

/** Reply to a comment via its Publisher, then flag it replied locally. */
export async function replyToComment(commentId: string, message: string): Promise<void> {
  const comment = await repo.getComment(commentId)
  if (!comment) throw new Error('El comentario no existe.')
  const publisher = socialRegistry().get(comment.platform)
  if (!canReply(publisher)) throw new Error('Esta red no permite responder comentarios.')
  await publisher.replyToComment(comment.remoteCommentId, message)
  await repo.markReplied(commentId)
}
