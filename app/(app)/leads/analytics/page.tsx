import { ArrowDownRight, ChartLine as ChartNoAxesCombined, Trophy, Users } from 'lucide-react'
import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { requireUser } from '@/lib/auth'
import { getLeadJourneyAnalytics } from '@/lib/leads/analytics'
import { leadAnalyticsRangeToDates, parseLeadAnalyticsRange } from '@/lib/leads/analytics-range'

import { LeadCreateDialog } from '../lead-create-dialog'
import { LeadsViewToggle } from '../view-toggle'
import { AnalyticsRangeSelector } from './analytics-range-selector'
import { LeadAnalyticsCharts } from './lead-analytics-charts'

export const metadata: Metadata = { title: 'Análisis de leads · doscientos' }
export const dynamic = 'force-dynamic'

export default async function LeadAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  await requireUser()
  const range = parseLeadAnalyticsRange((await searchParams).range)
  const dates = leadAnalyticsRangeToDates(range)
  const { analytics, error } = await getLeadJourneyAnalytics(dates)
  const actions = (
    <div className="flex items-center gap-2">
      <LeadsViewToggle view="analytics" />
      <LeadCreateDialog />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Análisis de leads"
        description={`Recorrido y conversión de los leads que entraron · ${dates.label}.`}
        actions={actions}
      />

      <div className="flex justify-end">
        <AnalyticsRangeSelector current={range} />
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-6 text-sm">{error}</CardContent>
        </Card>
      ) : !analytics || analytics.total === 0 ? (
        <Card>
          <CardContent className="px-0 pt-0">
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyTitle>No hay leads en este periodo.</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                Cambia el periodo o añade un nuevo lead para ver el recorrido.
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Resumen del embudo"
          >
            <Metric icon={Users} label="Leads entrados" value={String(analytics.total)} />
            <Metric icon={Trophy} label="Ganados" value={String(analytics.won)} tone="success" />
            <Metric
              icon={ChartNoAxesCombined}
              label="Conversión a cliente"
              value={`${analytics.conversionRate.toFixed(1)}%`}
              tone="info"
            />
            <Metric
              icon={ArrowDownRight}
              label={analytics.mainLeak?.label ?? 'Leads perdidos'}
              value={String(analytics.mainLeak?.value ?? analytics.lost)}
              tone="danger"
            />
          </section>
          <LeadAnalyticsCharts analytics={analytics} />
          <p className="text-muted-foreground text-xs">
            El Sankey refleja el primer recorrido comercial de cada lead. Las reaperturas se
            gestionan en Repesca para evitar mezclar ciclos distintos.
          </p>
        </>
      )}
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Users
  label: string
  value: string
  tone?: 'default' | 'success' | 'info' | 'danger'
}) {
  const tones = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-success/10 text-success',
    info: 'bg-info/10 text-info',
    danger: 'bg-danger/10 text-danger',
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className={`flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
