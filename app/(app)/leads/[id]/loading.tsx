import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function LeadDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[60, 140]} titleWidth={180} actions={[96, 110]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <DetailCardSkeleton
            titleWidth={96}
            labelWidth={80}
            rowWidths={[180, 220, 140, 200, 160]}
          />

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28 rounded" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-40 rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full rounded" />
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
