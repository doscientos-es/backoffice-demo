/**
 * Social Hub — Facebook Page Graph operations (low level).
 *
 * Pure API calls against the Page. The Publisher composes these. Facebook
 * publishes single assets directly (photos/videos/feed), and builds multi-photo
 * posts by uploading unpublished photos then attaching them to a feed story.
 */
import { serverEnv } from '@/lib/env'
import type { MediaItem, PlatformComment, PostInsights } from '@/lib/social/core'

import { graphDelete, graphGet, graphGetList, graphPost } from './graph-client'

/** Facebook Page id. Empty when unset. */
export function fbPageId(): string {
  return serverEnv().FACEBOOK_PAGE_ID ?? ''
}

/** A published feed story reference. `post_id` is the feed-addressable id. */
interface FeedRef {
  id: string
  post_id?: string
}

/** Publish a text-only status to the Page feed. */
export function publishText(message: string): Promise<FeedRef> {
  return graphPost<FeedRef>(`${fbPageId()}/feed`, { message })
}

/** Publish a single photo with caption. Returns the feed post id. */
export async function publishPhoto(imageUrl: string, caption: string): Promise<string> {
  const res = await graphPost<FeedRef>(`${fbPageId()}/photos`, {
    url: imageUrl,
    caption,
    published: 'true',
  })
  return res.post_id ?? res.id
}

/** Publish a single video with description. Returns the video id. */
export async function publishVideo(videoUrl: string, description: string): Promise<string> {
  const res = await graphPost<FeedRef>(`${fbPageId()}/videos`, {
    file_url: videoUrl,
    description,
  })
  return res.id
}

/** Upload an unpublished photo (for carousel attach). Returns media_fbid. */
async function uploadUnpublishedPhoto(imageUrl: string): Promise<string> {
  const res = await graphPost<FeedRef>(`${fbPageId()}/photos`, {
    url: imageUrl,
    published: 'false',
  })
  return res.id
}

/** Publish a multi-photo feed story by attaching uploaded photos. */
export async function publishPhotoCarousel(media: MediaItem[], message: string): Promise<string> {
  const photos = media.filter((m) => m.type === 'image')
  const ids = await Promise.all(photos.map((m) => uploadUnpublishedPhoto(m.publicUrl)))
  const attached: Record<string, string> = { message }
  ids.forEach((id, i) => {
    attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
  })
  const res = await graphPost<FeedRef>(`${fbPageId()}/feed`, attached)
  return res.post_id ?? res.id
}

/** Public permalink for a post/video, or null. */
export async function getPermalink(postId: string): Promise<string | null> {
  const post = await graphGet<{ permalink_url?: string }>(postId, {
    fields: 'permalink_url',
  })
  return post.permalink_url ?? null
}

interface FbEngagement {
  likes?: { summary?: { total_count?: number } }
  comments?: { summary?: { total_count?: number } }
  shares?: { count?: number }
}

interface FbInsightValue {
  name: string
  values: Array<{ value: number }>
}

/** Fetch normalised insights for a published Page post. */
export async function getPostInsights(postId: string): Promise<PostInsights> {
  const engagement = await graphGet<FbEngagement>(postId, {
    fields: 'likes.summary(true),comments.summary(true),shares',
  })
  const insights = await graphGet<{ data?: FbInsightValue[] }>(`${postId}/insights`, {
    // `post_impressions*` was deprecated above Graph API v25. `post_media_view`
    // is the supported replacement for the number of times the post was viewed.
    metric: 'post_media_view',
  }).catch(() => ({ data: [] as FbInsightValue[] }))

  const byName = new Map((insights.data ?? []).map((m) => [m.name, m.values[0]?.value ?? 0]))
  const likes = engagement.likes?.summary?.total_count ?? 0
  const comments = engagement.comments?.summary?.total_count ?? 0
  const shares = engagement.shares?.count ?? 0
  const reach = byName.get('post_media_view') ?? 0
  const engagementRate = reach > 0 ? (likes + comments + shares) / reach : 0

  return {
    impressions: byName.get('post_media_view') ?? 0,
    reach,
    likes,
    comments,
    shares,
    saves: 0,
    videoViews: 0,
    engagementRate: Number(engagementRate.toFixed(4)),
    raw: { engagement, insights: insights.data ?? [] },
  }
}

interface FbComment {
  id: string
  message?: string
  from?: { name?: string; id?: string }
  like_count?: number
  created_time?: string
}

/** Fetch all comments on a Page post, normalised. */
export async function getPostComments(postId: string): Promise<PlatformComment[]> {
  const comments = await graphGetList<FbComment>(`${postId}/comments`, {
    fields: 'id,message,from,like_count,created_time',
  })
  return comments.map((c) => ({
    remoteId: c.id,
    authorName: c.from?.name ?? '',
    authorId: c.from?.id ?? null,
    text: c.message ?? '',
    likeCount: c.like_count ?? 0,
    publishedAt: c.created_time ?? null,
  }))
}

/** Reply to a comment on Facebook. */
export async function replyToComment(commentId: string, message: string): Promise<void> {
  await graphPost(`${commentId}/comments`, { message })
}

/** Delete a published Page post (feed story, photo post, video…). */
export async function deletePost(remoteId: string): Promise<void> {
  await graphDelete(remoteId)
}
