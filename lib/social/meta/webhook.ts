import type { MetaCommentEvent } from '@/lib/social/automation/types'

type MetaWebhookEntry = {
  id: string
  changes?: Array<{ field?: string; value?: Record<string, unknown> }>
}

type MetaWebhookPayload = {
  object?: string
  entry?: MetaWebhookEntry[]
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return new Date(value * 1000).toISOString()
  return null
}

function parseInstagramComment(
  entry: MetaWebhookEntry,
  value: Record<string, unknown>,
): MetaCommentEvent | null {
  const media = value.media as Record<string, unknown> | undefined
  const from = value.from as Record<string, unknown> | undefined
  const remoteCommentId = stringValue(value.id) ?? stringValue(value.comment_id)
  const remotePostId = stringValue(media?.id) ?? stringValue(value.media_id)
  const text = stringValue(value.text) ?? stringValue(value.message)
  if (!remoteCommentId || !remotePostId || !text) return null
  return {
    platform: 'instagram',
    sourceId: entry.id,
    remotePostId,
    remoteCommentId,
    authorId: stringValue(from?.id),
    authorName: stringValue(from?.username) ?? stringValue(from?.name) ?? '',
    text,
    publishedAt: parseTimestamp(value.created_time),
  }
}

function parseFacebookComment(
  entry: MetaWebhookEntry,
  value: Record<string, unknown>,
): MetaCommentEvent | null {
  const from = value.from as Record<string, unknown> | undefined
  const remoteCommentId = stringValue(value.comment_id) ?? stringValue(value.id)
  const remotePostId = stringValue(value.post_id)
  const text = stringValue(value.message)
  if (!remoteCommentId || !remotePostId || !text) return null
  return {
    platform: 'facebook',
    sourceId: entry.id,
    remotePostId,
    remoteCommentId,
    authorId: stringValue(from?.id),
    authorName: stringValue(from?.name) ?? '',
    text,
    publishedAt: parseTimestamp(value.created_time),
  }
}

/** Convert both Meta webhook shapes into one internal comment event. */
export function parseMetaCommentEvents(payload: unknown): MetaCommentEvent[] {
  if (!payload || typeof payload !== 'object') return []
  const value = payload as MetaWebhookPayload
  if (!Array.isArray(value.entry)) return []

  const events: MetaCommentEvent[] = []
  for (const entry of value.entry) {
    for (const change of entry.changes ?? []) {
      if (!change.value) continue
      if (
        value.object === 'instagram' &&
        ['comments', 'live_comments'].includes(change.field ?? '')
      ) {
        const event = parseInstagramComment(entry, change.value)
        if (event) events.push(event)
      }
      if (value.object === 'page' && change.field === 'feed' && change.value.item === 'comment') {
        const event = parseFacebookComment(entry, change.value)
        if (event) events.push(event)
      }
    }
  }
  return events
}
