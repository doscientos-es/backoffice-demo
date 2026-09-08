'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { MonthlyPoint } from '@/lib/finance'
import { formatEUR } from '@/lib/utils'

const SERIES_LABEL: Record<'revenue' | 'expense' | 'net', string> = {
  revenue: 'Ingresos',
  expense: 'Gastos',
  net: 'Beneficio',
}

export function FinanceChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'color-mix(in oklab, var(--muted) 60%, transparent)' }}
            contentStyle={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              formatEUR(value),
              SERIES_LABEL[name as keyof typeof SERIES_LABEL] ?? name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            formatter={(value) => SERIES_LABEL[value as keyof typeof SERIES_LABEL] ?? value}
          />
          <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar
            dataKey="expense"
            fill="color-mix(in oklab, var(--destructive) 80%, transparent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Line
            type="monotone"
            dataKey="net"
            stroke="var(--info)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: 'var(--info)' }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
