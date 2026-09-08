import { Skeleton } from '@/components/ui/skeleton'

export default function TasksLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 flex-1 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
