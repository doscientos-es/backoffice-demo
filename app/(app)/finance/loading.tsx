import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'

import { ChartSkeleton, DetailsSkeleton, KpisSkeleton } from './_components/finance-skeletons'

export default function FinanceLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[]} titleWidth={120} withDescription actions={[110]} />
      <KpisSkeleton />
      <ChartSkeleton />
      <DetailsSkeleton />
    </div>
  )
}
