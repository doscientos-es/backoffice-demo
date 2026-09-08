'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatEUR } from '@/lib/utils'

export type MemberBar = { name: string; value: number }

export function FinanceMembersChart({ data }: { data: MemberBar[] }) {
  return (
    <div className="px-6" style={{ height: Math.max(120, data.length * 48) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={96}
          />
          <Tooltip
            cursor={{ fill: 'color-mix(in oklab, var(--muted) 60%, transparent)' }}
            contentStyle={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatEUR(value), 'Aportado']}
          />
          <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
