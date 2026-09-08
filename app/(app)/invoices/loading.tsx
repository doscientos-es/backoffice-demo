import { Skeleton } from '@/components/ui/skeleton'

export default function InvoicesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="rounded-lg border">
        {/* Table header */}
        <div className="flex gap-4 border-b px-4 py-3">
          {[120, 80, 80, 100, 80].map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton widths, order never changes
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows, order never changes
          <div key={i} className="flex gap-4 border-b px-4 py-3 last:border-0">
            {[120, 80, 80, 100, 80].map((w, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton widths, order never changes
              <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
