import { Skeleton } from '@/components/ui/skeleton'

export default function ClientsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="rounded-lg border">
        <div className="flex gap-4 border-b px-4 py-3">
          {[140, 120, 100, 80].map((w) => (
            <Skeleton key={w} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-4 border-b px-4 py-3 last:border-0">
            {[140, 120, 100, 80].map((w) => (
              <Skeleton key={w} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
