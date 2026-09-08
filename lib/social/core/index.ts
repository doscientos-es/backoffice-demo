/**
 * Social Hub core — public barrel.
 *
 * Import domain types, the Publisher port, registry and orchestrator from here
 * so consumers never reach into individual files. Infrastructure (adapters,
 * repository, services) lives outside this folder and depends inward on it.
 */

export * from './errors'
export type { CaptionByPlatform } from './orchestrator'
export { computeAggregateStatus, fanOutPublish } from './orchestrator'
export * from './publisher'
export { PublisherRegistry } from './registry'
export * from './types'

import type { ComposedPost, MediaItem, MediaKind } from './types'

/** Infer the composition kind from its media set (single source of truth). */
export function deriveMediaKind(media: MediaItem[]): MediaKind {
  if (media.length === 0) return 'text'
  if (media.length > 1) return 'carousel'
  return media[0]?.type === 'video' ? 'video' : 'photo'
}

/** Build a ComposedPost from raw parts, deriving its media kind. */
export function composePost(id: string, caption: string, media: MediaItem[]): ComposedPost {
  return { id, caption, media, mediaKind: deriveMediaKind(media) }
}
