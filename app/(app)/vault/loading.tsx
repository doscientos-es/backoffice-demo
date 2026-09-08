import { Skeleton } from '@/components/ui/skeleton'

export default function VaultLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
