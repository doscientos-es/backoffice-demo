import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClientDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[70, 140]} titleWidth={200} actions={[96]} />

      <DetailCardSkeleton titleWidth={80} rowWidths={[180, 140, 160, 120]} />

      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32 rounded" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-10 w-full rounded" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
