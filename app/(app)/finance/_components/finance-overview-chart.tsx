import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getFinanceMonthlySeries } from '@/lib/finance/queries'

import { FinanceChart } from '../finance-chart'

export async function FinanceOverviewChart() {
  const series = await getFinanceMonthlySeries()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ingresos vs gastos · últimos 6 meses</CardTitle>
          <Link href="/finance/expenses" className="text-muted-foreground text-xs hover:underline">
            Ver todos los gastos →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <FinanceChart data={series} />
      </CardContent>
    </Card>
  )
}
