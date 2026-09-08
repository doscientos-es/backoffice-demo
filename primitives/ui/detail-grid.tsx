import type { ReactNode } from 'react'

import { cn } from '../lib/utils'

export function DetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        'grid min-w-0 grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm',
        className,
      )}
    >
      {children}
    </dl>
  )
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-primary min-w-0 wrap-break-word">{children ?? '—'}</dd>
    </>
  )
}
