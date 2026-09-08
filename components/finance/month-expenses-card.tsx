import { ChartPie as PieChart, Receipt, Scale } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getMonthFinanceSummary } from '@/lib/dashboard/queries'
import type { MonthFinanceSummary } from '@/lib/dashboard/types'
import { cn, formatEUR } from '@/lib/utils'

const percentFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

function formatMargin(margin: number | null): string {
  if (margin === null) return '—'
  return `${percentFmt.format(margin)}%`
}

/**
 * Presentational tile summarising the current month's finance: registered
 * expenses as the headline, the resulting net vs invoiced revenue and the
 * dominant expense category. Mirrors the visual structure of the Meta Ads
 * balance tile so they share the dashboard row.
 */
export function MonthExpensesCard({ data }: { data: MonthFinanceSummary }) {
  const { revenueMonth, expenseMonth, netMonth, margin, topCategory } = data

  const netNegative = netMonth < 0
  const netClass = netNegative
    ? 'text-red-600 dark:text-red-400'
    : netMonth > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-foreground'
  const headlineClass =
    expenseMonth === 0
      ? 'text-muted-foreground'
      : netNegative
        ? 'text-red-600 dark:text-red-400'
        : 'text-foreground'
  const iconClass = netNegative
    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
    : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Gasto del mes</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">Gastos registrados este mes</p>
        </div>
        <div
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconClass)}
        >
          <Receipt className="size-4" aria-hidden />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div>
          <div className={cn('text-3xl font-semibold tabular-nums', headlineClass)}>
            {formatEUR(expenseMonth)}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {revenueMonth > 0
              ? `Sobre ${formatEUR(revenueMonth)} ingresados · margen ${formatMargin(margin)}`
              : 'Aún no hay ingresos este mes'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Scale className="size-3.5" aria-hidden />
              Neto
            </div>
            <div className={cn('mt-1 font-medium tabular-nums', netClass)}>
              {formatEUR(netMonth)}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <PieChart className="size-3.5" aria-hidden />
              Top categoría
            </div>
            <div
              className="mt-1 truncate font-medium tabular-nums"
              title={topCategory?.label ?? undefined}
            >
              {topCategory ? `${topCategory.label} · ${formatEUR(topCategory.total)}` : '—'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Async server wrapper that fetches the monthly summary and renders the card.
 * Designed for the dashboard but reusable from any page that wants the tile.
 */
export async function MonthExpensesWidget() {
  const data = await getMonthFinanceSummary()
  return <MonthExpensesCard data={data} />
}

/** Loading placeholder mirroring the card layout for Suspense boundaries. */
export function MonthExpensesSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="size-9 rounded-lg" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}
