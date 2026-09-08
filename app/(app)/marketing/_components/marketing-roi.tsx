import { BadgeCheck, Coins, HandCoins, Percent, Target, TrendingUp } from 'lucide-react'

import { StatCard } from '@/components/layout/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMarketingRoi } from '@/lib/marketing/queries'
import { roasTone } from '@/lib/marketing/roi'
import { formatEUR } from '@/lib/utils'

import { numberFmt, percentFmt } from './marketing-format'

type MarketingRoiProps = {
  since: string
  until: string
  rangeLabel: string
}

/**
 * Closes the marketing loop: shows what each acquired customer costs (CAC) and
 * how many euros each euro of ad spend has returned (ROAS). Attribution is
 * Meta-only (leads tagged `meta_lead_ads` that converted into clients), so it
 * sits in its own card below the channel KPIs to avoid implying it covers
 * every source.
 */
export async function MarketingRoi({ since, until, rangeLabel }: MarketingRoiProps) {
  const roi = await getMarketingRoi(since, until)

  const cacValue = roi.cac !== null ? `${formatEUR(roi.cac)} / cliente` : '—'
  const roasValue = roi.roas !== null ? `${percentFmt.format(roi.roas)}×` : '—'
  const closedRateValue =
    roi.closedLeadRate !== null ? percentFmt.format(roi.closedLeadRate * 100) : '—'
  const averageClosedValue =
    roi.averageClosedValue !== null ? formatEUR(roi.averageClosedValue) : '—'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adquisición y cierres (CAC / ROAS)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="CAC Meta"
          value={cacValue}
          tone="default"
          icon={Target}
          hint={`${rangeLabel} · ${roi.acquiredCustomers} adquiridos`}
        />
        <StatCard
          label="Leads ganados"
          value={numberFmt.format(roi.closedLeads)}
          tone={roi.closedLeads > 0 ? 'success' : 'default'}
          icon={BadgeCheck}
          hint={`${numberFmt.format(roi.totalLeads)} leads creados`}
        />
        <StatCard
          label="Conversión a cierre"
          value={closedRateValue}
          tone={roi.closedLeadRate !== null && roi.closedLeadRate >= 0.1 ? 'success' : 'default'}
          icon={Percent}
          hint="ganados / leads"
        />
        <StatCard
          label="ROAS"
          value={roasValue}
          tone={roasTone(roi.roas)}
          icon={TrendingUp}
          hint="ingresos / gasto"
        />
        <StatCard
          label="Ingresos atribuidos"
          value={formatEUR(roi.revenue)}
          tone="info"
          icon={Coins}
          hint="facturado por clientes Meta"
        />
        <StatCard
          label="Gasto Meta"
          value={formatEUR(roi.spend)}
          tone="default"
          icon={HandCoins}
          hint={`${roi.leads} leads atribuidos`}
        />
        <StatCard
          label="Ticket estimado"
          value={averageClosedValue}
          tone="info"
          icon={Coins}
          hint="valor medio de ganados"
        />
      </CardContent>
    </Card>
  )
}
