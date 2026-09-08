import { cn } from '../lib/utils'
import { Card, CardContent } from './card'
import { Skeleton } from '@doscientos/ui'

export type FormCardSkeletonProps = {
  /** Number of single-line form rows. */
  rows?: number
  /** Show a textarea-sized block at the end of the rows. */
  withTextarea?: boolean
  /** Show cancel + submit buttons under a top border. */
  withSubmit?: boolean
  /** Optional grid pattern: number of columns for the rows. */
  columns?: 1 | 2
  className?: string
}

/** Mirrors the "Card + FormRow… + submit" pattern used across new/edit pages. */
export function FormCardSkeleton({
  rows = 4,
  withTextarea = false,
  withSubmit = true,
  columns = 1,
  className,
}: FormCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-5">
          <div className={cn('grid gap-5', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
            {Array.from({ length: rows }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows, order never changes
              <FormRowSkeleton key={i} />
            ))}
          </div>
          {withTextarea ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          ) : null}
          {withSubmit ? (
            <div className="border-border flex justify-end gap-2 border-t pt-4">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-32 rounded-md" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function FormRowSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  )
}
