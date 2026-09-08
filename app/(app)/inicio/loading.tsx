import { Skeleton } from '@/components/ui/skeleton'

const KPI_KEYS = ['a', 'b', 'c', 'd'] as const

export default function InicioLoading() {
  return (
    <div className="flex flex-col gap-10 pb-4">
      <div className="border-border bg-card rounded-2xl border px-5 py-6 sm:px-7 sm:py-7">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <section className="flex flex-col gap-5">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-6 w-56" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {KPI_KEYS.slice(0, 3).map((key) => (
            <Skeleton key={key} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </section>
      <section className="border-border bg-muted/30 rounded-2xl border p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_KEYS.map((key) => (
            <Skeleton key={key} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  )
}
