import { DetailCardSkeleton } from '@/components/layout/detail-grid-skeleton'
import { PageHeaderSkeleton } from '@/components/layout/page-header-skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const LINE_WIDTHS = [200, 60, 80, 60, 80]

export default function InvoiceDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton breadcrumbs={[70, 120, 140, 110]} titleWidth={240} actions={[80, 110]} />

      <DetailCardSkeleton rowWidths={[180, 200, 140, 160, 200]} />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32 rounded" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="border-border/60 flex gap-4 border-b pb-2">
            {LINE_WIDTHS.map((w, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton widths, order never changes
              <Skeleton key={`h-${w}-${i}`} className="h-3 rounded" style={{ width: w }} />
            ))}
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 py-1.5">
              {LINE_WIDTHS.map((w, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton widths, order never changes
                <Skeleton key={`r-${w}-${j}`} className="h-4 rounded" style={{ width: w }} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex justify-end gap-8 py-4">
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
