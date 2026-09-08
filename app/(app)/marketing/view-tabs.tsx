'use client'

import { Megaphone, Target } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import type { MarketingView } from '@/lib/marketing/range'
import { cn } from '@/lib/utils'

const TABS: { value: MarketingView; label: string; icon: typeof Target }[] = [
  { value: 'ads', label: 'Por anuncio', icon: Target },
  { value: 'campaigns', label: 'Por campaña', icon: Megaphone },
]

export function MarketingViewTabs({ current }: { current: MarketingView }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const onSelect = (next: MarketingView) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'ads') params.delete('view')
    else params.set('view', next)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Vista"
      className={cn(
        'inline-flex h-9 items-center rounded-lg border bg-card p-0.5 text-sm',
        pending && 'opacity-70',
      )}
    >
      {TABS.map((tab) => {
        const active = tab.value === current
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
