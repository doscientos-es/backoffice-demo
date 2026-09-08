import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[80, 120, 160]} titleWidth={220} actions={[80, 64, 80]} />

      <DetailCardSkeleton rowWidths={[200, 160, 180, 140]} />

      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-28 rounded" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-9 w-full rounded" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
