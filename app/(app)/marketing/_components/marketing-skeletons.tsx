import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const KPI_SKELETON_KEYS = ['kpi-a', 'kpi-b', 'kpi-c', 'kpi-d'] as const
const TABLE_ROW_KEYS = ['row-a', 'row-b', 'row-c', 'row-d', 'row-e'] as const
const TABLE_COL_WIDTHS = [180, 100, 80, 80, 100] as const

export function KpiSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_SKELETON_KEYS.map((key) => (
        <Card key={key}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-6 w-24 rounded" />
            </div>
            <Skeleton className="size-9 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function RoiSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-56 rounded" />
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-20 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  )
}

export function InsightsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 w-full rounded-md" />
      </CardContent>
    </Card>
  )
}

export function AttributionSkeleton() {
  const COL_WIDTHS = [120, 60, 80, 70, 80, 90] as const
  const ROW_KEYS = ['af-a', 'af-b', 'af-c'] as const
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 rounded" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="border-border/60 flex gap-4 border-b pb-2">
          {COL_WIDTHS.map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <Skeleton key={`afh-${w}-${i}`} className="h-3 rounded" style={{ width: w }} />
          ))}
        </div>
        {ROW_KEYS.map((key) => (
          <div key={key} className="flex gap-4 py-1.5">
            {COL_WIDTHS.map((w, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              <Skeleton key={`${key}-${w}-${j}`} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 rounded" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="border-border/60 flex gap-4 border-b pb-2">
          {TABLE_COL_WIDTHS.map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <Skeleton key={`head-${w}-${i}`} className="h-3 rounded" style={{ width: w }} />
          ))}
        </div>
        {TABLE_ROW_KEYS.map((key) => (
          <div key={key} className="flex gap-4 py-1.5">
            {TABLE_COL_WIDTHS.map((w, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              <Skeleton key={`${key}-${w}-${j}`} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
