'use client'

import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  InsightsBreakdown,
  InsightsBreakdownPoint,
  InsightsSeriesMeta,
} from '@/lib/marketing/types'
import { INSIGHTS_OTHERS_KEY } from '@/lib/marketing/types'
import { formatEUR } from '@/lib/utils'

/** Series key used for the leads line in the legend/visibility toggles. */
const LEADS_KEY = '__leads__'
const LEADS_COLOR = 'var(--info)'
/** Neutral tone for the aggregated "Otros" bucket. */
const OTHERS_COLOR = 'var(--muted-foreground)'

/** Categorical palette for the top spend series (avoids the leads-line blue). */
const SERIES_PALETTE = ['#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const dayFmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' })

/** Renders a `YYYY-MM-DD` string as a short, localized day label. */
function formatDay(value: string): string {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  return dayFmt.format(new Date(y, m - 1, d))
}

/** Resolves the fill color for a series key given its stack position. */
function colorFor(key: string, index: number): string {
  if (key === INSIGHTS_OTHERS_KEY) return OTHERS_COLOR
  return SERIES_PALETTE[index % SERIES_PALETTE.length] as string
}

type TooltipContentProps = {
  series: InsightsSeriesMeta[]
  colorByKey: Map<string, string>
  active?: boolean
  payload?: Array<{ payload?: InsightsBreakdownPoint }>
}

/**
 * Tooltip showing the day's total spend and leads plus the per-series spend
 * breakdown (with its share of the day's total), sorted high-to-low.
 */
function InsightsTooltip({ series, colorByKey, active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  const total = point.total || 0
  const rows = series
    .map((s) => ({ ...s, value: Number(point[s.key] ?? 0) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div className="border-border bg-background rounded-lg border p-2.5 text-xs shadow-md">
      <div className="mb-1.5 flex items-center justify-between gap-4 font-medium">
        <span>{formatDay(point.date)}</span>
        <span className="text-muted-foreground">
          {formatEUR(total)} · {point.leads} leads
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-xs"
              style={{ background: colorByKey.get(row.key) }}
            />
            <span className="max-w-40 truncate">{row.label}</span>
            <span className="ml-auto tabular-nums">{formatEUR(row.value)}</span>
            <span className="text-muted-foreground w-9 text-right tabular-nums">
              {total > 0 ? `${Math.round((row.value / total) * 100)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Evolution chart for the marketing dashboard: daily spend as stacked bars
 * broken down by ad or campaign (top spenders + an "Otros" bucket) and daily
 * Meta-attributed leads as a line, on independent Y axes (euros vs. count).
 * The legend toggles each series — including the leads line — on and off.
 */
export function InsightsChart({ breakdown }: { breakdown: InsightsBreakdown }) {
  const { points, series } = breakdown
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const colorByKey = new Map<string, string>(series.map((s, i) => [s.key, colorFor(s.key, i)]))

  const toggle = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const legendItems: InsightsSeriesMeta[] = [...series, { key: LEADS_KEY, label: 'Leads' }]

  return (
    <div className="flex flex-col gap-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatDay}
              minTickGap={24}
            />
            <YAxis
              yAxisId="spend"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              width={44}
            />
            <YAxis
              yAxisId="leads"
              orientation="right"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: 'color-mix(in oklab, var(--muted) 60%, transparent)' }}
              content={<InsightsTooltip series={series} colorByKey={colorByKey} />}
            />
            {series.map((s) => (
              <Bar
                key={s.key}
                yAxisId="spend"
                stackId="spend"
                dataKey={s.key}
                name={s.label}
                fill={colorByKey.get(s.key)}
                hide={hidden.has(s.key)}
                maxBarSize={28}
              />
            ))}
            <Line
              yAxisId="leads"
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke={LEADS_COLOR}
              strokeWidth={2}
              dot={false}
              hide={hidden.has(LEADS_KEY)}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {legendItems.map((item) => {
          const isHidden = hidden.has(item.key)
          const color = item.key === LEADS_KEY ? LEADS_COLOR : colorByKey.get(item.key)
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-opacity"
              style={{ opacity: isHidden ? 0.4 : 1 }}
            >
              <span className="size-2.5 shrink-0 rounded-xs" style={{ background: color }} />
              <span className="max-w-40 truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
