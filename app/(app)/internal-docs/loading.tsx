import { Skeleton } from '@/components/ui/skeleton'

export default function InternalDocsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-40" />
      <div className="rounded-lg border">
        <div className="flex gap-4 border-b px-4 py-3">
          {[180, 90, 70, 80, 100].map((w) => (
            <Skeleton key={w} className="h-4 rounded" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex gap-4 border-b px-4 py-3 last:border-0">
            {[180, 90, 70, 80, 100].map((w) => (
              <Skeleton key={w} className="h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
