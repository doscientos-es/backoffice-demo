import { cn } from '../lib/utils'

const SIZE: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[11px]',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
}

function initials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const letters =
    parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : (parts[0]?.[0] ?? '?')
  return letters.toUpperCase()
}

/**
 * Avatar for any entity (client, lead, company) that may have a logo URL.
 * Shows the logo image when available; falls back to a coloured initials circle.
 *
 * Intentionally uses a plain <img> tag (not next/image) so it works in both
 * server and client components without needing width/height props or an allowed
 * domains config — logos are already optimised on upload.
 */
export function EntityAvatar({
  name,
  logoUrl,
  size = 'sm',
  className,
}: {
  name: string
  logoUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  if (logoUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: URL externa de avatar, no compatible con next/image
      <img
        src={logoUrl}
        alt={name}
        className={cn(
          'shrink-0 rounded-md border border-border/50 bg-background object-contain p-0.5',
          SIZE[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md bg-primary/10 font-semibold uppercase text-primary',
        SIZE[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
