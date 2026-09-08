import type { ComponentProps } from 'react'

import { Badge } from '@/components/ui/badge'
import type { StatusMeta } from '@/lib/status'

export type StatusBadgeProps<T extends string> = Omit<
  ComponentProps<typeof Badge>,
  'variant' | 'children'
> & {
  /** Per-domain metadata map (label + badge variant), e.g. `INVOICE_STATUS`. */
  meta: StatusMeta<T>
  /** Status value coming from the DB. May be unknown to the map. */
  value: string | null | undefined
  /** Rendered when `value` is not present in `meta`. Defaults to the raw value. */
  fallbackLabel?: string
  /** Optional prefix prepended to the resolved label (e.g. `"Verifactu: "`). */
  labelPrefix?: string
}

/**
 * Thin wrapper around `Badge` that resolves both the label and the variant from
 * a `StatusMeta` map. Replaces the `<Badge variant={MAP[x]}>{LABEL[x]}</Badge>`
 * pattern that was duplicated 25+ times across listings, detail pages and the
 * public portal.
 */
export function StatusBadge<T extends string>({
  meta,
  value,
  fallbackLabel,
  labelPrefix,
  ...rest
}: StatusBadgeProps<T>) {
  const entry = value
    ? (meta as Record<string, { label: string; variant: ComponentProps<typeof Badge>['variant'] }>)[
        value
      ]
    : undefined
  const label = entry?.label ?? fallbackLabel ?? value ?? '—'
  return (
    <Badge variant={entry?.variant ?? 'neutral'} {...rest}>
      {labelPrefix ? `${labelPrefix}${label}` : label}
    </Badge>
  )
}
