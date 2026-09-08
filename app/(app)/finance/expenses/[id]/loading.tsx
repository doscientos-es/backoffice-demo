import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ExpenseDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton
        breadcrumbs={[]}
        titleWidth={200}
        withDescription
        actions={[80, 96, 96]}
      />

      <DetailCardSkeleton labelWidth={80} rowWidths={[180, 140, 120, 160, 200]} />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28 rounded" />
        </CardHeader>
        <CardContent className="flex justify-end gap-8 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-5 w-24 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
