/**
 * Social Hub — the Publisher port (hexagonal architecture).
 *
 * Every network implements this interface. The orchestrator and services
 * depend ONLY on this abstraction (Dependency Inversion), never on a concrete
 * platform client. Analytics methods are optional so a network can ship
 * publishing first and add insights/comments later without breaking callers
 * (Interface Segregation via optional members).
 */
import type {
  ComposedPost,
  PlatformComment,
  PostInsights,
  PublishOutcome,
  PublishSupport,
  SocialPlatform,
} from './types'

export interface Publisher {
  /** Which network this adapter drives. */
  readonly platform: SocialPlatform

  /**
   * Whether this Publisher is usable right now (credentials present). Lets the
   * UI/service skip or warn instead of throwing mid-fan-out.
   */
  isConfigured(): boolean

  /** Capability check for a specific post (media kind, count, size…). */
  supports(post: ComposedPost): PublishSupport

  /** Publish the post. Throws {@link SocialError} subclasses on failure. */
  publish(post: ComposedPost): Promise<PublishOutcome>

  /** Latest metrics for a previously published target. */
  fetchInsights?(remoteId: string): Promise<PostInsights>

  /** Comments on a previously published target. */
  fetchComments?(remoteId: string): Promise<PlatformComment[]>

  /** Reply to a comment by its remote id. */
  replyToComment?(remoteCommentId: string, message: string): Promise<void>

  /** Delete a previously published post/media from the network. */
  deletePost?(remoteId: string): Promise<void>
}

/** Type guard: does this Publisher expose insight fetching? */
export function canFetchInsights(
  p: Publisher,
): p is Publisher & Required<Pick<Publisher, 'fetchInsights'>> {
  return typeof p.fetchInsights === 'function'
}

/** Type guard: does this Publisher expose comment fetching? */
export function canFetchComments(
  p: Publisher,
): p is Publisher & Required<Pick<Publisher, 'fetchComments'>> {
  return typeof p.fetchComments === 'function'
}

/** Type guard: can this Publisher reply to comments? */
export function canReply(
  p: Publisher,
): p is Publisher & Required<Pick<Publisher, 'replyToComment'>> {
  return typeof p.replyToComment === 'function'
}

/** Type guard: can this Publisher delete a published post from the network? */
export function canDeleteRemote(
  p: Publisher,
): p is Publisher & Required<Pick<Publisher, 'deletePost'>> {
  return typeof p.deletePost === 'function'
}
