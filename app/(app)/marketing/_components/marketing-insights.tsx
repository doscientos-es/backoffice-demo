import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getInsightsBreakdownSeries } from '@/lib/marketing/queries'
import type { MarketingView } from '@/lib/marketing/range'

import { InsightsChart } from '../insights-chart'

export async function MarketingInsights({
  since,
  until,
  view,
}: {
  since: string
  until: string
  view: MarketingView
}) {
  const breakdown = await getInsightsBreakdownSeries({ since, until, dimension: view })
  if (breakdown.points.length === 0) return null

  const title = view === 'campaigns' ? 'Gasto diario por campaña' : 'Gasto diario por anuncio'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <InsightsChart breakdown={breakdown} />
      </CardContent>
    </Card>
  )
}
