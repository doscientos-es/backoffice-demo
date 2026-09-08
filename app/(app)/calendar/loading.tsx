import { Skeleton } from '@/components/ui/skeleton'

export default function CalendarLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="size-8 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="border-border bg-border grid grid-cols-7 gap-px overflow-hidden rounded-lg border">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="bg-muted h-6 w-full rounded-none" />
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton cells, order never changes
          <Skeleton key={i} className="bg-card h-24 w-full rounded-none" />
        ))}
      </div>
    </div>
  )
}
