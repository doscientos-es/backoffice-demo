import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

import { InsightsSkeleton, KpiSkeleton, TableSkeleton } from './_components/marketing-skeletons'

export default function MarketingLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[]} titleWidth={180} withDescription actions={[120]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-9 w-56 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      <KpiSkeleton />
      <InsightsSkeleton />
      <TableSkeleton />
    </div>
  )
}
