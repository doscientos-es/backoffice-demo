import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { getRevenueSeries } from '@/lib/dashboard/queries'

import { RevenueChart } from '../revenue-chart'

export async function RevenueWidget() {
  const data = await getRevenueSeries(6)
  const hasData = data.some((p) => p.current > 0 || p.previous > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos · últimos 6 meses</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <RevenueChart data={data} />
        ) : (
          <Empty className="h-56">
            <EmptyHeader>
              <EmptyTitle>Aún no hay ingresos</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <Link href="/invoices">Emitir primera factura</Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
