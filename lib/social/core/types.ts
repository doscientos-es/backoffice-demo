/**
 * Social Hub — core domain types.
 *
 * This layer is infrastructure-agnostic: no Supabase, no fetch, no env. It
 * defines the vocabulary every platform adapter and the orchestrator speak.
 * Adapters translate these types to/from their own APIs.
 */

/** Networks the hub can publish to. Add a new value + a Publisher to extend. */
export type SocialPlatform = 'instagram' | 'facebook'

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  'instagram',
  'facebook',
] as const

/** High-level shape of the composition, derived from its media. */
export type MediaKind = 'text' | 'photo' | 'video' | 'carousel'

/** Lifecycle of a composed post (aggregate of its targets). */
export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partially_failed'
  | 'failed'

/** Lifecycle of a single (post, platform) target. */
export type TargetStatus = 'pending' | 'publishing' | 'published' | 'failed'

/** A single uploaded media asset, already public-URL addressable. */
export interface MediaItem {
  storagePath: string
  publicUrl: string
  type: 'image' | 'video'
  mime: string
}

/** The platform-neutral post handed to every Publisher. */
export interface ComposedPost {
  id: string
  caption: string
  mediaKind: MediaKind
  media: MediaItem[]
}

/** Successful publish return from a Publisher. */
export interface PublishOutcome {
  remoteId: string
  remoteUrl: string | null
}

/** Capability answer: can this Publisher handle this post as-is? */
export type PublishSupport = { ok: true } | { ok: false; reason: string }

/** Per-target result of a fan-out publish. */
export interface TargetResult {
  platform: SocialPlatform
  ok: boolean
  remoteId?: string
  remoteUrl?: string | null
  error?: string
}

/** Aggregated outcome of publishing one post to N platforms. */
export interface FanOutResult {
  status: PostStatus
  targets: TargetResult[]
}

/** Normalised metrics snapshot for a published target. */
export interface PostInsights {
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  videoViews: number
  /** Platform-specific actions such as CTA clicks. */
  actions?: number
  /** 0..1 (likes+comments+shares+saves / reach). */
  engagementRate: number
  raw: unknown
}

/** Normalised comment fetched from a platform. */
export interface PlatformComment {
  remoteId: string
  authorName: string
  authorId: string | null
  text: string
  likeCount: number
  /** ISO timestamp, or null when the platform omits it. */
  publishedAt: string | null
}

/** Human-readable labels for each network (UI + logs). */
export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}
