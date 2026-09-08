import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export type WordmarkProps = HTMLAttributes<HTMLSpanElement>

/**
 * Wordmark for the doscientos brand. Inherits typography from the parent;
 * apply text size / weight utilities via `className` when needed.
 */
export function Wordmark({ className, ...props }: WordmarkProps) {
  return (
    <span
      className={cn(
        'font-semibold tracking-tight text-[color:var(--text-primary,inherit)] select-none',
        className,
      )}
      {...props}
    >
      doscientos
    </span>
  )
}
