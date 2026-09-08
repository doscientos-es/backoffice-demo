import { MousePointerClick, TrendingUp, Users, Wallet } from 'lucide-react'

import { StatCard } from '@/components/layout/stat-card'
import { getMarketingOverview } from '@/lib/marketing/queries'
import type { MarketingSort, MarketingView } from '@/lib/marketing/range'
import { formatEUR } from '@/lib/utils'

import { cplTone, numberFmt } from './marketing-format'

type MarketingKpisProps = {
  view: MarketingView
  since: string
  until: string
  sort: MarketingSort
  showPaused: boolean
  rangeLabel: string
}

export async function MarketingKpis({
  view,
  since,
  until,
  sort,
  showPaused,
  rangeLabel,
}: MarketingKpisProps) {
  const { totalSpent, totalLeads, totalOutboundClicks, totalLandingPageViews, avgCpl } =
    await getMarketingOverview(view, since, until, sort, showPaused)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label="Gasto"
        value={formatEUR(totalSpent)}
        tone="default"
        icon={Wallet}
        hint={rangeLabel}
      />
      <StatCard label="Leads (Meta)" value={totalLeads} tone="info" icon={Users} />
      <StatCard
        label="CPL promedio"
        value={totalLeads > 0 ? `${formatEUR(avgCpl)} / lead` : '—'}
        tone={cplTone(avgCpl, totalLeads)}
        icon={TrendingUp}
      />
      <StatCard
        label="Clics salientes"
        value={numberFmt.format(totalOutboundClicks)}
        tone="default"
        icon={MousePointerClick}
      />
      <StatCard
        label="Vistas de landing"
        value={numberFmt.format(totalLandingPageViews)}
        tone="default"
        icon={MousePointerClick}
      />
    </div>
  )
}
