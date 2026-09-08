'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import type { DashboardRange } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'

const OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'ytd', label: 'Año' },
]

export function RangeSelector({ current }: { current: DashboardRange }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const onSelect = (next: DashboardRange) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === '30d') params.delete('range')
    else params.set('range', next)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Rango temporal"
      className={cn(
        'inline-flex h-8 items-center rounded-lg border bg-card p-0.5 text-xs',
        pending && 'opacity-70',
      )}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === current
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(opt.value)}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
