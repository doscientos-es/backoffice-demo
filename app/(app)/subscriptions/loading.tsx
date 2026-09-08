import { Skeleton } from '@/components/ui/skeleton'

export default function SubscriptionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>
      <div className="rounded-lg border">
        {/* Table header */}
        <div className="flex gap-4 border-b px-4 py-3">
          {[120, 140, 90, 80, 110, 120].map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton widths, order never changes
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-4 border-b px-4 py-3 last:border-0">
            {[120, 140, 90, 80, 110, 120].map((w, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton widths, order never changes
              <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
