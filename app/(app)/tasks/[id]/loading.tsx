import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function TaskDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[60, 140]} titleWidth={240} actions={[80, 96]} />

      <DetailCardSkeleton rowWidths={[160, 200, 140, 180]} />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32 rounded" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded" />
          {[0, 1].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-32 rounded" />
                <Skeleton className="h-4 w-full rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
