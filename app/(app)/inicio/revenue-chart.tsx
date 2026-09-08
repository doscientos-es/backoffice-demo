'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { RevenuePoint } from '@/lib/dashboard/types'
import { formatEUR } from '@/lib/utils'

export type { RevenuePoint }

const SERIES_LABEL: Record<string, string> = {
  current: 'Año actual',
  previous: 'Año anterior',
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  // ResponsiveContainer reads DOM dimensions — skip SSR to prevent hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-56 w-full" />

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'color-mix(in oklab, var(--muted) 60%, transparent)' }}
            contentStyle={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name) => [
              formatEUR(value),
              SERIES_LABEL[String(name)] ?? String(name),
            ]}
          />
          <Legend
            verticalAlign="top"
            height={24}
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
            formatter={(value) => SERIES_LABEL[String(value)] ?? String(value)}
          />
          <Bar
            dataKey="previous"
            fill="var(--muted-foreground)"
            fillOpacity={0.35}
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
          <Bar dataKey="current" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
