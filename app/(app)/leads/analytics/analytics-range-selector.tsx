'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Select } from '@/components/ui/select'
import { LEAD_ANALYTICS_RANGE_OPTIONS, type LeadAnalyticsRange } from '@/lib/leads/analytics-range'
import { cn } from '@/lib/utils'

export function AnalyticsRangeSelector({ current }: { current: LeadAnalyticsRange }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const onSelect = (next: LeadAnalyticsRange) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === '90d') params.delete('range')
    else params.set('range', next)
    const query = params.toString()
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    )
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs', pending && 'opacity-70')}>
      <span className="text-muted-foreground font-medium">Periodo</span>
      <Select
        aria-label="Periodo de análisis"
        value={current}
        onChange={(event) => onSelect(event.target.value as LeadAnalyticsRange)}
        className="h-8 w-40 text-xs"
      >
        {LEAD_ANALYTICS_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
