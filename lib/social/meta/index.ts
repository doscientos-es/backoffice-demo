/**
 * Social Hub — Meta adapters barrel.
 *
 * Exposes the Instagram and Facebook Publishers plus the shared Graph client.
 * Both reuse META_PAGE_ACCESS_TOKEN + META_GRAPH_API_VERSION; they self-report
 * `isConfigured()` so the registry can skip them when their ids are absent.
 */

export { FacebookPublisher } from './facebook-publisher'
export { graphGet, graphGetList, graphPost, metaPageToken } from './graph-client'
export { InstagramPublisher } from './instagram-publisher'
