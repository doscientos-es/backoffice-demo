import type { Metadata } from 'next'
import Link from 'next/link'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { SectionBoundary } from '@/components/ui/error-boundary'
import { requirePageRole } from '@/lib/auth'
import { getProjectPortfolio } from '@/lib/finance/portfolio'
import { cn, formatEUR } from '@/lib/utils'

export const metadata: Metadata = { title: 'Portfolio · doscientos' }
export const dynamic = 'force-dynamic'

function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground">—</span>
  const positive = pct >= 0
  return (
    <Badge variant={pct >= 30 ? 'success' : pct >= 0 ? 'warning' : 'destructive'}>
      {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </Badge>
  )
}

async function PortfolioTable() {
  const rows = await getProjectPortfolio()

  // Sort: by margin descending (negative margins last)
  const sorted = [...rows].sort((a, b) => b.margin - a.margin)

  const totalRevenue = sorted.reduce((s, r) => s + r.revenue, 0)
  const totalCost = sorted.reduce((s, r) => s + r.totalCost, 0)
  const totalMargin = sorted.reduce((s, r) => s + r.margin, 0)
  const totalHours = sorted.reduce((s, r) => s + r.hours, 0)

  if (sorted.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Aún no hay proyectos con datos económicos.
      </p>
    )
  }

  return (
    <div className="border-border bg-card overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs">
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 text-right font-medium">Facturado</th>
            <th className="px-4 py-3 text-right font-medium">Horas</th>
            <th className="px-4 py-3 text-right font-medium">Coste total</th>
            <th className="px-4 py-3 text-right font-medium">Margen €</th>
            <th className="px-4 py-3 text-right font-medium">Margen %</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {sorted.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/projects/${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
              </td>
              <td className="text-muted-foreground px-4 py-3">
                {row.clientId ? (
                  <Link href={`/clients/${row.clientId}`} className="hover:underline">
                    {row.clientName ?? '—'}
                  </Link>
                ) : (
                  (row.clientName ?? '—')
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatEUR(row.revenue)}</td>
              <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
                {row.hours > 0 ? `${row.hours.toFixed(1)} h` : '—'}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatEUR(row.totalCost)}</td>
              <td
                className={cn(
                  'px-4 py-3 text-right tabular-nums font-medium',
                  row.margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                )}
              >
                {formatEUR(row.margin)}
              </td>
              <td className="px-4 py-3 text-right">
                <MarginBadge pct={row.marginPct} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-border bg-muted/20 border-t-2 text-sm font-semibold">
            <td className="px-4 py-3" colSpan={2}>
              Total ({sorted.length} proyectos)
            </td>
            <td className="px-4 py-3 text-right tabular-nums">{formatEUR(totalRevenue)}</td>
            <td className="text-muted-foreground px-4 py-3 text-right tabular-nums">
              {totalHours > 0 ? `${totalHours.toFixed(1)} h` : '—'}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">{formatEUR(totalCost)}</td>
            <td
              className={cn(
                'px-4 py-3 text-right tabular-nums',
                totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {formatEUR(totalMargin)}
            </td>
            <td className="px-4 py-3 text-right">
              <MarginBadge
                pct={
                  totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 100 * 10) / 10 : null
                }
              />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="divide-border divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <div key={i} className="flex gap-4 px-4 py-3">
            <div className="bg-muted h-4 w-40 animate-pulse rounded" />
            <div className="bg-muted h-4 w-24 animate-pulse rounded" />
            <div className="bg-muted ml-auto h-4 w-16 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function PortfolioPage() {
  await requirePageRole(['owner', 'admin'])

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/finance" label="Finanzas" />
      <PageHeader
        title="Portfolio de rentabilidad"
        description="Margen real por proyecto: facturado − (horas × coste/hora) − gastos directos."
      />
      <SectionBoundary pending={<TableSkeleton />} label="No se pudo cargar el portfolio">
        <PortfolioTable />
      </SectionBoundary>
    </div>
  )
}
