import { Skeleton } from '@/components/ui/skeleton'

export default function BrandLoading() {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="border-border flex gap-0.5 border-b">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="mb-2 h-5 w-20 rounded" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
