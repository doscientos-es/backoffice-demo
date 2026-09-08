import { Skeleton } from '@/components/ui/skeleton'

export default function ProposalsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
      <div className="rounded-lg border">
        <div className="flex gap-4 border-b px-4 py-3">
          {[140, 100, 80, 81, 82].map((w, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <Skeleton key={i} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 border-b px-4 py-3 last:border-0">
            {[140, 100, 80, 81, 82].map((w, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              <Skeleton key={j} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
