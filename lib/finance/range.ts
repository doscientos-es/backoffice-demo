/**
 * Finance dashboard date-range parsing.
 * URL-driven so server components can render the right window without client state.
 * Default range: "month" (current calendar month).
 */

export type FinanceRange = 'month' | 'last_month' | 'ytd' | '90d' | '365d' | 'max'

const VALID_RANGES: ReadonlySet<FinanceRange> = new Set([
  'month',
  'last_month',
  'ytd',
  '90d',
  '365d',
  'max',
])

export const FINANCE_RANGE_OPTIONS: { value: FinanceRange; label: string }[] = [
  { value: 'month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
  { value: 'ytd', label: 'Este año' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: '365d', label: 'Último año' },
  { value: 'max', label: 'Histórico' },
]

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0] ?? ''
}

export function parseFinanceRange(value: string | string[] | undefined): FinanceRange {
  const v = Array.isArray(value) ? value[0] : value
  return v && VALID_RANGES.has(v as FinanceRange) ? (v as FinanceRange) : 'month'
}

export function financeRangeToDates(range: FinanceRange): {
  since: string
  until: string
  label: string
} {
  const now = new Date()
  const until = toIsoDate(now)
  const daysAgo = (n: number) => toIsoDate(new Date(now.getTime() - n * 86_400_000))

  switch (range) {
    case 'month':
      return {
        since: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        until,
        label: 'Este mes',
      }
    case 'last_month':
      return {
        since: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        until: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
        label: 'Mes pasado',
      }
    case 'ytd':
      return {
        since: toIsoDate(new Date(now.getFullYear(), 0, 1)),
        until,
        label: 'Este año',
      }
    case '90d':
      return { since: daysAgo(90), until, label: 'Últimos 90 días' }
    case '365d':
      return { since: daysAgo(365), until, label: 'Último año' }
    case 'max':
      return { since: '2000-01-01', until, label: 'Histórico' }
  }
}
