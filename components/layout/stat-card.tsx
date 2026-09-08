import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import type { Trend } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'

export type StatTone = 'default' | 'success' | 'danger' | 'info' | 'warning'

export type GoalProp = {
  /** Raw numeric current value (same unit as target). */
  current: number
  /** Raw numeric target value. */
  target: number
}

export type StatCardProps = {
  label: string
  value: number | string
  /** Reduces padding and type scale for dense dashboard summaries. */
  density?: 'default' | 'compact'
  tone?: StatTone
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  hint?: string
  href?: string
  trend?: Trend | null
  /** When provided, replaces the trend with a goal progress bar. */
  goal?: GoalProp
}

const TONE_VALUE: Record<StatTone, string> = {
  default: 'text-foreground',
  success: 'text-emerald-700 dark:text-emerald-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-sky-700 dark:text-sky-400',
  warning: 'text-amber-700 dark:text-amber-400',
}

const TONE_ICON: Record<StatTone, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

const TREND_STYLE = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  flat: 'text-muted-foreground',
} as const

const TREND_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const

const GOAL_BAR_COLOR = (pct: number) => {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 80) return 'bg-sky-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-muted-foreground/40'
}

export function StatCard({
  label,
  value,
  density = 'default',
  tone = 'default',
  icon: Icon,
  hint,
  href,
  trend,
  goal,
}: StatCardProps) {
  const compact = density === 'compact'
  const displayValue =
    typeof value === 'number' ? new Intl.NumberFormat('es-ES').format(value) : value
  const TrendIcon = trend && !goal ? TREND_ICON[trend.direction] : null

  const goalPct = goal ? Math.min((goal.current / goal.target) * 100, 100) : null

  const card = (
    <Card
      size={compact ? 'sm' : 'default'}
      className={cn(
        'h-full transition-colors hover:bg-muted/80',
        href && 'cursor-pointer hover:ring-foreground/10',
      )}
    >
      <CardContent className={cn('flex items-start justify-between', compact ? 'gap-2 pt-3' : 'gap-3 pt-5')}>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-muted-foreground font-medium tracking-wide uppercase',
              compact ? 'text-[11px] leading-4' : 'text-xs',
            )}
          >
            {label}
          </div>
          <div
            className={cn(
              'truncate font-semibold tracking-tight tabular-nums',
              compact ? 'mt-0.5 text-xl leading-6' : 'mt-1.5 text-2xl',
              TONE_VALUE[tone],
            )}
          >
            {displayValue}
          </div>

          {/* Goal progress bar — replaces trend when a goal is set */}
          {goalPct !== null ? (
            <div className="mt-2 space-y-1">
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={cn('h-full rounded-full transition-all', GOAL_BAR_COLOR(goalPct))}
                  style={{ width: `${goalPct}%` }}
                />
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
                <span
                  className={cn(
                    goalPct >= 100 && 'font-medium text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {Math.round(goalPct)}% del objetivo
                </span>
                {hint ? <span>· {hint}</span> : null}
              </div>
            </div>
          ) : trend && TrendIcon ? (
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-xs font-medium tabular-nums',
                TREND_STYLE[trend.direction],
              )}
            >
              <TrendIcon className="size-3" aria-hidden />
              <span>
                {trend.delta > 0 ? '+' : ''}
                {trend.delta.toFixed(1)}%
              </span>
              {hint ? <span className="text-muted-foreground">· {hint}</span> : null}
            </div>
          ) : hint ? (
            <div
              className={cn(
                'text-muted-foreground',
                compact ? 'mt-0.5 text-[11px] leading-4' : 'mt-1 text-xs',
              )}
            >
              {hint}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center',
              compact ? 'size-7 rounded-md' : 'size-9 rounded-lg',
              TONE_ICON[tone],
            )}
          >
            <Icon className={compact ? 'size-3.5' : 'size-4'} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    )
  }

  return card
}
