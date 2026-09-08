import { TriangleAlert as AlertTriangle, HandCoins, Hourglass } from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getAccountsReceivable } from '@/lib/dashboard/queries'
import type { AccountsReceivable } from '@/lib/dashboard/types'
import { cn, formatEUR } from '@/lib/utils'

const numberFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

function pluralize(count: number, singular: string, plural: string): string {
  return `${numberFmt.format(count)} ${count === 1 ? singular : plural}`
}

/**
 * Presentational tile summarising Accounts Receivable: how much money is
 * already invoiced but not yet collected, with a dedicated overdue breakdown
 * and how much was collected within the current calendar month. Mirrors the
 * Meta Ads balance tile so both fit the same dashboard row.
 */
export function AccountsReceivableCard({ data }: { data: AccountsReceivable }) {
  const { pendingTotal, pendingCount, overdueTotal, overdueCount, paidMonthTotal, paidMonthCount } =
    data

  const hasOverdue = overdueCount > 0
  const balanceClass = hasOverdue
    ? 'text-amber-600 dark:text-amber-400'
    : pendingTotal > 0
      ? 'text-foreground'
      : 'text-muted-foreground'
  const iconClass = hasOverdue
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Cobro pendiente</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">Facturado sin cobrar</p>
        </div>
        <div
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconClass)}
        >
          <HandCoins className="size-4" aria-hidden />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div>
          <div className={cn('text-3xl font-semibold tabular-nums', balanceClass)}>
            {formatEUR(pendingTotal)}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {paidMonthTotal > 0
              ? `${formatEUR(paidMonthTotal)} cobrado este mes · ${pluralize(paidMonthCount, 'factura', 'facturas')}`
              : 'Aún no se ha cobrado nada este mes'}
          </p>
        </div>

        {hasOverdue ? (
          <Link
            href="/invoices?status=overdue"
            className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {formatEUR(overdueTotal)} en{' '}
              {pluralize(overdueCount, 'factura vencida', 'facturas vencidas')} · cobrar ya
            </span>
          </Link>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Hourglass className="size-3.5" aria-hidden />
              Pendientes
            </div>
            <div className="mt-1 font-medium tabular-nums">
              {pluralize(pendingCount, 'factura', 'facturas')}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5" aria-hidden />
              Vencidas
            </div>
            <div
              className={cn(
                'mt-1 font-medium tabular-nums',
                hasOverdue && 'text-amber-600 dark:text-amber-400',
              )}
            >
              {hasOverdue ? formatEUR(overdueTotal) : '—'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Async server wrapper that fetches the A/R snapshot and renders the card.
 * Designed for the dashboard but reusable from any page that wants the tile.
 */
export async function AccountsReceivableWidget() {
  const data = await getAccountsReceivable()
  return <AccountsReceivableCard data={data} />
}

/** Loading placeholder mirroring the card layout for Suspense boundaries. */
export function AccountsReceivableSkeleton() {
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
