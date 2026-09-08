import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

import { LogoMark } from './logo-mark'
import { Wordmark } from './wordmark'

type LogoSize = 'sm' | 'md' | 'lg'

const MARK_PX: Record<LogoSize, number> = { sm: 16, md: 20, lg: 28 }
const TEXT_CLASS: Record<LogoSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
}
const GAP_CLASS: Record<LogoSize, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2.5',
}

export type LogoProps = HTMLAttributes<HTMLSpanElement> & {
  /** Visual size of the lockup. Defaults to `md`. */
  size?: LogoSize
  /** Hide the wordmark and render the mark only. */
  markOnly?: boolean
  /** Additional classes applied to the mark container. */
  markClassName?: string
  /** Override typography on the wordmark. */
  wordmarkClassName?: string
}

/** Brand lockup: theme-aware mark + "doscientos" wordmark. */
export function Logo({
  size = 'md',
  markOnly = false,
  className,
  markClassName,
  wordmarkClassName,
  ...props
}: LogoProps) {
  return (
    <span className={cn('inline-flex items-center', GAP_CLASS[size], className)} {...props}>
      <LogoMark size={MARK_PX[size]} className={markClassName} />
      {markOnly ? null : <Wordmark className={cn(TEXT_CLASS[size], wordmarkClassName)} />}
    </span>
  )
}
