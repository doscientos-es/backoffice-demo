import { Image as ImageIcon, Play } from 'lucide-react'

import type { MediaItem } from '@/lib/social/core'
import { cn } from '@/lib/utils'

/**
 * Renders a single media asset as a square thumbnail. Uses a plain <img> (the
 * URLs are public Supabase objects); videos show a poster-less frame with a
 * play glyph so no remote-image config is required.
 */
export function MediaThumb({ item, className }: { item: MediaItem; className?: string }) {
  const base = cn('relative aspect-square overflow-hidden rounded-lg bg-muted', className)
  if (item.type === 'video') {
    return (
      <div className={base}>
        <video src={item.publicUrl} className="size-full object-cover" muted playsInline />
        <span className="absolute inset-0 grid place-content-center bg-black/20 text-white">
          <Play className="size-5 fill-current" />
        </span>
      </div>
    )
  }
  return (
    <div className={base}>
      {/* biome-ignore lint/performance/noImgElement: URL externa de Supabase Storage, no compatible con next/image */}
      <img src={item.publicUrl} alt="" className="size-full object-cover" loading="lazy" />
    </div>
  )
}

/** Compact media summary for lists: first asset + a "+N" overlay. */
export function MediaPreview({ media, className }: { media: MediaItem[]; className?: string }) {
  const first = media[0]
  if (!first) {
    return (
      <div
        className={cn(
          'grid aspect-square place-content-center rounded-lg bg-muted text-muted-foreground',
          className,
        )}
      >
        <ImageIcon className="size-5" />
      </div>
    )
  }
  return (
    <div className={cn('relative', className)}>
      <MediaThumb item={first} />
      {media.length > 1 && (
        <span className="absolute right-1 bottom-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          +{media.length - 1}
        </span>
      )}
    </div>
  )
}
