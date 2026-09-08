import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { SectionBoundary } from '@/components/ui/error-boundary'
import { requirePageRole } from '@/lib/auth'
import { financeRangeToDates, parseFinanceRange } from '@/lib/finance/range'

import { FinanceDetails } from './_components/finance-details'
import { FinanceKpis } from './_components/finance-kpis'
import { FinanceOverviewChart } from './_components/finance-overview-chart'
import { FinanceRangeSelector } from './_components/finance-range-selector'
import { ChartSkeleton, DetailsSkeleton, KpisSkeleton } from './_components/finance-skeletons'

export const metadata: Metadata = { title: 'Finanzas · doscientos' }
export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ range?: string }>

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(['owner', 'admin'])
  const sp = await searchParams
  const range = parseFinanceRange(sp.range)
  const { since, until, label: rangeLabel } = financeRangeToDates(range)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finanzas"
        description={`Ingresos (facturas) vs gastos operativos · ${rangeLabel}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/finance/portfolio">Portfolio</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/finance/expenses">Ver gastos</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/finance/received-invoices">Facturas recibidas</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/finance/expenses/new">Nuevo gasto</Link>
            </Button>
          </div>
        }
      />

      <FinanceRangeSelector current={range} />

      <SectionBoundary
        key={`kpis-${since}-${until}`}
        pending={<KpisSkeleton />}
        label="No se pudieron cargar los KPIs"
      >
        <FinanceKpis since={since} until={until} rangeLabel={rangeLabel} />
      </SectionBoundary>

      <SectionBoundary pending={<ChartSkeleton />} label="No se pudo cargar el gráfico">
        <FinanceOverviewChart />
      </SectionBoundary>

      <SectionBoundary
        key={`details-${since}-${until}`}
        pending={<DetailsSkeleton />}
        label="No se pudieron cargar los detalles"
      >
        <FinanceDetails since={since} until={until} rangeLabel={rangeLabel} />
      </SectionBoundary>
    </div>
  )
}
