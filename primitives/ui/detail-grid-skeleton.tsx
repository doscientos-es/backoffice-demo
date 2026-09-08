import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader } from './card'
import { Skeleton } from '@doscientos/ui'

export type DetailGridSkeletonProps = {
  /** Width of each row's value cell in px. Length defines number of rows. */
  rowWidths?: number[]
  /** Width of every label cell in px. */
  labelWidth?: number
  className?: string
}

/** Mirrors DetailGrid + DetailRow layout for loading states. */
export function DetailGridSkeleton({
  rowWidths = [180, 140, 160, 120],
  labelWidth = 96,
  className,
}: DetailGridSkeletonProps) {
  return (
    <dl
      className={cn(
        'grid min-w-0 grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm',
        className,
      )}
    >
      {rowWidths.map((w) => (
        <div key={w} className="contents">
          <Skeleton className="h-4 max-w-full rounded" style={{ width: labelWidth }} />
          <Skeleton className="h-4 max-w-full rounded" style={{ width: w }} />
        </div>
      ))}
    </dl>
  )
}

export type DetailCardSkeletonProps = DetailGridSkeletonProps & {
  /** Width of the card header title skeleton in px. */
  titleWidth?: number
}

/** Card + header title + DetailGridSkeleton, the canonical "datos" card. */
export function DetailCardSkeleton({
  titleWidth = 96,
  rowWidths,
  labelWidth,
  className,
}: DetailCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 rounded" style={{ width: titleWidth }} />
      </CardHeader>
      <CardContent>
        <DetailGridSkeleton rowWidths={rowWidths} labelWidth={labelWidth} />
      </CardContent>
    </Card>
  )
}
