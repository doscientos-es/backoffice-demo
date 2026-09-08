import type { CSSProperties, HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export type LogoMarkProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Pixel size applied to both width and height. */
  size?: number
  /** Accessible title; when omitted the mark is treated as decorative. */
  title?: string
  /** Select a fixed asset or follow the backoffice theme. */
  variant?: 'auto' | 'brand' | 'light'
}

/** Theme-aware mark backed by the canonical brand assets in `public/brand`. */
export function LogoMark({
  size = 24,
  title,
  variant = 'auto',
  className,
  style,
  ...props
}: LogoMarkProps) {
  const decorative = !title
  const sizeStyle = { ...style, '--logo-mark-size': `${size}px` } as CSSProperties

  return (
    <span
      role="img"
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      className={cn(
        'inline-block size-[var(--logo-mark-size)] shrink-0 overflow-hidden rounded-[22%]',
        className,
      )}
      style={sizeStyle}
      {...props}
    >
      {variant !== 'brand' ? (
        // biome-ignore lint/performance/noImgElement: SVG público pequeño sin beneficio de optimización.
        <img
          src="/brand/logo-light.svg"
          alt=""
          className={cn('size-full', variant === 'auto' && 'dark:hidden')}
        />
      ) : null}
      {variant !== 'light' ? (
        // biome-ignore lint/performance/noImgElement: SVG público pequeño sin beneficio de optimización.
        <img
          src="/brand/logo.svg"
          alt=""
          className={cn('size-full', variant === 'auto' && 'hidden dark:block')}
        />
      ) : null}
    </span>
  )
}
