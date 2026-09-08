/**
 * Social Hub — persistence & view models.
 *
 * camelCase shapes the repository maps DB rows into, consumed by server
 * components, actions and the UI. Kept separate from lib/social/core (pure
 * domain) so the domain never leaks Supabase row shapes and vice-versa.
 */
import type {
  MediaItem,
  MediaKind,
  PostStatus,
  SocialPlatform,
  TargetStatus,
} from '@/lib/social/core'

/** A single (post, platform) target as stored, for lists and detail views. */
export interface TargetView {
  id: string
  platform: SocialPlatform
  status: TargetStatus
  /** Per-network copy override. `null` means it inherits the post caption. */
  caption: string | null
  remoteId: string | null
  remoteUrl: string | null
  error: string | null
  publishedAt: string | null
}

/** Row of the posts list (dashboard/calendar), with its targets summarised. */
export interface PostListItem {
  id: string
  caption: string
  mediaKind: MediaKind
  media: MediaItem[]
  status: PostStatus
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  targets: TargetView[]
  /** Engagement summed across every target, from the latest insights sync. */
  metrics: { likes: number; comments: number; actions: number }
}

/** Insights snapshot as stored per target. */
export interface InsightsView {
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  videoViews: number
  actions: number
  engagementRate: number
  fetchedAt: string
}

/** A target enriched with its latest insights, for the analytics view. */
export interface TargetWithInsights extends TargetView {
  insights: InsightsView | null
}

/** Full detail of one composed post, including synced comments. */
export interface PostDetail extends PostListItem {
  targets: TargetWithInsights[]
  comments: CommentView[]
}

/** A comment in the unified inbox, joined with its post caption. */
export interface CommentView {
  id: string
  targetId: string
  platform: SocialPlatform
  remoteCommentId: string
  authorName: string
  text: string
  likeCount: number
  replied: boolean
  publishedAt: string | null
  postId: string
  postCaption: string
}

/** Input to create a composed post (already-uploaded media + target set). */
export interface CreatePostInput {
  /** Shared copy, used as the default for every target. */
  caption: string
  media: MediaItem[]
  platforms: SocialPlatform[]
  /**
   * Optional per-network copy overrides. Any platform omitted here inherits
   * {@link caption}; provided values are stored on that platform's target.
   */
  captions?: Partial<Record<SocialPlatform, string>>
  scheduledAt: string | null
  createdBy: string | null
  automation?: {
    keyword: string
    publicReply: string
    privateMessage: string
    platforms: Extract<SocialPlatform, 'instagram' | 'facebook'>[]
  }
}
