import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function DocumentDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[90, 200]} titleWidth={260} actions={[110]} />

      <DetailCardSkeleton labelWidth={80} rowWidths={[200, 120, 100, 160]} />

      <Card>
        <CardContent className="p-0">
          <Skeleton className="h-[480px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}
