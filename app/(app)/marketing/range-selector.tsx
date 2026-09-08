'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Select } from '@/components/ui/select'
import { type MarketingRange, RANGE_OPTIONS } from '@/lib/marketing/range'
import { cn } from '@/lib/utils'

/**
 * Date-range picker. Uses a single dropdown rather than a tab strip because
 * Meta exposes many windows (up to the 37-month historical max) and they would
 * not fit inline.
 */
export function MarketingRangeSelector({ current }: { current: MarketingRange }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const onSelect = (next: MarketingRange) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === '30d') params.delete('range')
    else params.set('range', next)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs', pending && 'opacity-70')}>
      <span className="text-muted-foreground font-medium">Periodo</span>
      <Select
        aria-label="Rango temporal"
        value={current}
        onChange={(e) => onSelect(e.target.value as MarketingRange)}
        className="h-8 w-44 text-xs"
      >
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
