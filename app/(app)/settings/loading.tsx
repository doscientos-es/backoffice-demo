import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <Skeleton className="h-7 w-28" />
      {Array.from({ length: 3 }).map((_, section) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
        <div key={section} className="flex flex-col gap-4 rounded-lg border p-6">
          <Skeleton className="h-5 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, field) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              <div key={field} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
