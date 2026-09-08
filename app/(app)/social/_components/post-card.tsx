import {
  CalendarDays as CalendarClock,
  Heart,
  MessageCircle,
  MessageSquareText,
  MousePointerClick,
} from 'lucide-react'
import Link from 'next/link'

import { StatusBadge } from '@/components/ui/status-badge'
import type { PostListItem } from '@/lib/social/types'
import { SOCIAL_POST_STATUS, SOCIAL_TARGET_STATUS } from '@/lib/status'
import { cn, relativeTime } from '@/lib/utils'

import { DeletePostButton } from './delete-post-button'
import { MediaPreview } from './media-thumb'
import { PlatformIcon } from './platform'
import { PublishButton } from './publish-button'

/**
 * One post in the dashboard list. Presentational (server) — shows the media
 * preview, caption, aggregate status and a per-target status row. Draft /
 * scheduled / failed posts expose a publish (or retry) action inline.
 */
export function PostCard({ post }: { post: PostListItem }) {
  const canPublish =
    post.status === 'draft' ||
    post.status === 'scheduled' ||
    post.status === 'failed' ||
    post.status === 'partially_failed'
  const isRetry = post.status === 'failed' || post.status === 'partially_failed'
  const caption = post.caption.trim() || 'Sin texto'
  const showMetrics = post.status === 'published' || post.status === 'partially_failed'

  return (
    <div className="group border-border bg-card hover:border-primary/30 flex flex-col gap-3 rounded-xl border p-3 transition-all hover:shadow-md">
      <div className="flex gap-3">
        <Link href={`/social/${post.id}`} className="shrink-0" aria-label="Ver detalle del post">
          <MediaPreview media={post.media} className="size-20" />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/social/${post.id}`}
              className="text-foreground group-hover:text-primary line-clamp-2 text-sm font-medium transition-colors"
            >
              {caption}
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <StatusBadge meta={SOCIAL_POST_STATUS} value={post.status} />
              <DeletePostButton postId={post.id} />
            </div>
          </div>

          {/* Per-target status pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {post.targets.map((t) => (
              <span
                key={t.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-border/70 px-1.5 py-0.5 text-[10px]',
                  t.status === 'failed' && 'border-destructive/40 text-destructive',
                )}
                title={t.error ?? undefined}
              >
                <PlatformIcon platform={t.platform} className="size-3" />
                <StatusBadge
                  meta={SOCIAL_TARGET_STATUS}
                  value={t.status}
                  className="border-0 bg-transparent px-0 py-0"
                />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-border/60 flex items-center justify-between gap-2 border-t pt-2">
        <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
          <span title={post.createdAt}>{relativeTime(post.createdAt)}</span>
          {post.scheduledAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" />
              {relativeTime(post.scheduledAt)}
            </span>
          )}
          {showMetrics && (
            <span
              className="inline-flex items-center gap-2"
              title="Interacción sumada de todas las redes"
            >
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3" />
                {post.metrics.likes}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3" />
                {post.metrics.comments}
              </span>
              {post.metrics.actions > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick className="size-3" />
                  {post.metrics.actions}
                </span>
              )}
            </span>
          )}
          <Link
            href={`/social/${post.id}`}
            className="hover:text-foreground inline-flex items-center gap-1"
          >
            <MessageSquareText className="size-3" />
            Detalle
          </Link>
        </div>
        {canPublish && (
          <PublishButton
            postId={post.id}
            retry={isRetry}
            label={isRetry ? undefined : 'Publicar'}
          />
        )}
      </div>
    </div>
  )
}
