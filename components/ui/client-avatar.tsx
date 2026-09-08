import Image from 'next/image'

import { cn } from '@/lib/utils'

const SIZE_MAP = {
  xs: { px: 24, text: 'text-[9px]' },
  sm: { px: 28, text: 'text-[10px]' },
  md: { px: 36, text: 'text-xs' },
  lg: { px: 48, text: 'text-sm' },
  xl: { px: 64, text: 'text-base' },
} as const

type AvatarSize = keyof typeof SIZE_MAP

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase()
}

export function ClientAvatar({
  name,
  logoUrl,
  size = 'sm',
  className,
}: {
  name: string
  logoUrl?: string | null
  size?: AvatarSize
  className?: string
}) {
  const { px, text } = SIZE_MAP[size]

  if (logoUrl) {
    return (
      <span
        className={cn('shrink-0 overflow-hidden rounded-md bg-muted', className)}
        style={{ width: px, height: px }}
      >
        <Image
          src={logoUrl}
          alt={`Logo ${name}`}
          width={px}
          height={px}
          className="h-full w-full object-contain"
          unoptimized
        />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'shrink-0 inline-flex items-center justify-center rounded-md bg-primary/10 font-semibold uppercase text-primary',
        text,
        className,
      )}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {getInitials(name)}
    </span>
  )
}
