/**
 * Social Hub — Instagram Graph operations (low level).
 *
 * Pure API calls against the IG Business account. The Publisher class composes
 * these; keeping them here isolates the two-step container→publish protocol and
 * the video-processing poll from the Publisher's capability/orchestration logic.
 */
import { serverEnv } from '@/lib/env'
import type { MediaItem, PlatformComment, PostInsights } from '@/lib/social/core'
import { PublishError } from '@/lib/social/core'

import { graphDelete, graphGet, graphGetList, graphPost } from './graph-client'

/** IG Business account id (ig user id). Empty when unset. */
export function igUserId(): string {
  return serverEnv().INSTAGRAM_BUSINESS_ACCOUNT_ID ?? ''
}

interface ContainerRef {
  id: string
}

export interface InstagramMedia {
  id: string
  caption?: string
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  children?: { data?: InstagramMedia[] }
}

/** Fetch every media item currently available for the connected IG account. */
export function getAccountMedia(): Promise<InstagramMedia[]> {
  return graphGetList<InstagramMedia>(`${igUserId()}/media`, {
    fields:
      'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}',
  })
}

/** Create a single-photo container. */
export function createPhotoContainer(imageUrl: string, caption: string): Promise<ContainerRef> {
  return graphPost<ContainerRef>(`${igUserId()}/media`, { image_url: imageUrl, caption })
}

/** Create a Reels/video container (IG publishes standalone video as REELS). */
export function createVideoContainer(videoUrl: string, caption: string): Promise<ContainerRef> {
  return graphPost<ContainerRef>(`${igUserId()}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
  })
}

/** Create one carousel child container (no caption on children). */
export function createCarouselChild(item: MediaItem): Promise<ContainerRef> {
  const params: Record<string, string> =
    item.type === 'video'
      ? { media_type: 'VIDEO', video_url: item.publicUrl, is_carousel_item: 'true' }
      : { image_url: item.publicUrl, is_carousel_item: 'true' }
  return graphPost<ContainerRef>(`${igUserId()}/media`, params)
}

/** Wrap N child ids into a CAROUSEL parent container. */
export function createCarouselContainer(
  childIds: string[],
  caption: string,
): Promise<ContainerRef> {
  return graphPost<ContainerRef>(`${igUserId()}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  })
}

/** Publish a finished container, returning the published media id. */
export function publishContainer(creationId: string): Promise<ContainerRef> {
  return graphPost<ContainerRef>(`${igUserId()}/media_publish`, { creation_id: creationId })
}

/**
 * Poll a container until it finishes processing (video/reels only). Photos are
 * ready immediately so callers skip this. Throws if it errors or times out.
 */
export async function waitForContainer(
  creationId: string,
  { attempts = 30, intervalMs = 3000 } = {},
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const { status_code } = await graphGet<{ status_code?: string }>(creationId, {
      fields: 'status_code',
    })
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new PublishError('instagram', `El contenedor de vídeo falló (${status_code}).`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new PublishError('instagram', 'El vídeo tardó demasiado en procesarse.')
}

/** Public permalink for a published media, or null. */
export async function getPermalink(mediaId: string): Promise<string | null> {
  const media = await graphGet<{ permalink?: string }>(mediaId, { fields: 'permalink' })
  return media.permalink ?? null
}

interface IgMediaFields {
  like_count?: number
  comments_count?: number
  media_product_type?: string
}

interface IgInsightValue {
  name: string
  values: Array<{ value: number }>
}

/** Fetch normalised insights for a published IG media. */
export async function getMediaInsights(mediaId: string): Promise<PostInsights> {
  const fields = await graphGet<IgMediaFields>(mediaId, {
    fields: 'like_count,comments_count,media_product_type',
  })
  // Keep this list to metrics supported for feed media. Requesting a metric
  // unavailable for one media type makes Meta reject the whole insights call.
  const metrics = 'reach,saved'
  const insights = await graphGet<{ data?: IgInsightValue[] }>(`${mediaId}/insights`, {
    metric: metrics,
  }).catch(() => ({ data: [] as IgInsightValue[] }))

  const byName = new Map((insights.data ?? []).map((m) => [m.name, m.values[0]?.value ?? 0]))
  const likes = fields.like_count ?? 0
  const comments = fields.comments_count ?? 0
  const shares = byName.get('shares') ?? 0
  const saves = byName.get('saved') ?? 0
  const reach = byName.get('reach') ?? 0
  const engagementRate = reach > 0 ? (likes + comments + shares + saves) / reach : 0

  return {
    impressions: byName.get('views') ?? 0,
    reach,
    likes,
    comments,
    shares,
    saves,
    videoViews: byName.get('views') ?? 0,
    engagementRate: Number(engagementRate.toFixed(4)),
    raw: { fields, insights: insights.data ?? [] },
  }
}

interface IgComment {
  id: string
  text?: string
  username?: string
  like_count?: number
  timestamp?: string
}

/** Fetch all comments on a published IG media, normalised. */
export async function getMediaComments(mediaId: string): Promise<PlatformComment[]> {
  const comments = await graphGetList<IgComment>(`${mediaId}/comments`, {
    fields: 'id,text,username,like_count,timestamp',
  })
  return comments.map((c) => ({
    remoteId: c.id,
    authorName: c.username ?? '',
    authorId: null,
    text: c.text ?? '',
    likeCount: c.like_count ?? 0,
    publishedAt: c.timestamp ?? null,
  }))
}

/** Reply to a comment on IG. */
export async function replyToComment(commentId: string, message: string): Promise<void> {
  await graphPost(`${commentId}/replies`, { message })
}

/** Delete a published IG media (photo, reel, carousel). */
export async function deleteMedia(mediaId: string): Promise<void> {
  await graphDelete(mediaId)
}
