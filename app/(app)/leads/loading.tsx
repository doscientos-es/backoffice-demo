import { Skeleton } from '@/components/ui/skeleton'

export default function LeadsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      {/* Kanban columns skeleton */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, col) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton columns, order never changes
          <div key={col} className="flex w-64 shrink-0 flex-col gap-3">
            <Skeleton className="h-6 w-28 rounded" />
            {Array.from({ length: 3 }).map((_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows, order never changes
              <Skeleton key={row} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
