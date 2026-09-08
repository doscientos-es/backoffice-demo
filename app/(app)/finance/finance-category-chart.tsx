'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { formatEUR } from '@/lib/utils'

export type CategorySlice = { name: string; value: number }

/** Palette built from semantic tokens so it adapts to light/dark themes. */
const PALETTE = [
  'var(--primary)',
  'var(--info)',
  'var(--warning)',
  'var(--success)',
  'color-mix(in oklab, var(--primary) 55%, var(--info))',
  'var(--muted-foreground)',
] as const

export function FinanceCategoryChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-5 px-6 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={76}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [formatEUR(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex w-full flex-col gap-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {formatEUR(d.value)}
              {total > 0 ? (
                <span className="text-muted-foreground ml-1.5 text-xs">
                  {Math.round((d.value / total) * 100)}%
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
