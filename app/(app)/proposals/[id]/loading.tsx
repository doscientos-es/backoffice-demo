import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProposalDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[80, 120, 160]} titleWidth={240} actions={[110, 130]} />

      <DetailCardSkeleton titleWidth={112} rowWidths={[180, 200, 140, 160]} />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36 rounded" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32 rounded" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="border-border/60 flex items-center gap-3 rounded-md border p-3">
              <Skeleton className="size-8 rounded" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-3 w-60 rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
