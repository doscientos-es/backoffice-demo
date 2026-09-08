/**
 * Marketing dashboard date-range and sort parsing.
 * All UI controls are URL-driven so the server component can render the right
 * window without any client-side state.
 */

/**
 * Meta's Insights API only serves up to ~37 months of historical data, so the
 * "Histórico" range is capped to that window rather than being truly unbounded.
 */
export const META_INSIGHTS_MAX_MONTHS = 37

export type MarketingRange =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d'
  | 'month'
  | 'last_month'
  | 'ytd'
  | 'max'

const VALID_RANGES: ReadonlySet<MarketingRange> = new Set([
  '7d',
  '30d',
  '90d',
  '180d',
  '365d',
  'month',
  'last_month',
  'ytd',
  'max',
])

export const RANGE_OPTIONS: { value: MarketingRange; label: string; short: string }[] = [
  { value: '7d', label: 'Últimos 7 días', short: '7d' },
  { value: '30d', label: 'Últimos 30 días', short: '30d' },
  { value: '90d', label: 'Últimos 90 días', short: '90d' },
  { value: '180d', label: 'Últimos 180 días', short: '180d' },
  { value: '365d', label: 'Último año (365 días)', short: '365d' },
  { value: 'month', label: 'Este mes', short: 'Mes' },
  { value: 'last_month', label: 'Mes pasado', short: 'Mes ant.' },
  { value: 'ytd', label: 'Este año', short: 'Año' },
  { value: 'max', label: 'Histórico (máx. Meta)', short: 'Máx' },
]

export function parseMarketingRange(value: string | string[] | undefined): MarketingRange {
  const v = Array.isArray(value) ? value[0] : value
  return v && VALID_RANGES.has(v as MarketingRange) ? (v as MarketingRange) : '30d'
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0] ?? ''
}

/**
 * Earliest date Meta will return insights for (today minus the API's 37-month
 * limit). Used as the floor for the "Histórico" range and for sync windows.
 */
export function metaHistoryFloor(now: Date = new Date()): string {
  const d = new Date(now)
  d.setMonth(d.getMonth() - META_INSIGHTS_MAX_MONTHS)
  return toIsoDate(d)
}

export function rangeToDates(range: MarketingRange): {
  since: string
  until: string
  label: string
} {
  const now = new Date()
  const until = toIsoDate(now)
  const daysAgo = (n: number) => toIsoDate(new Date(now.getTime() - n * 86_400_000))
  switch (range) {
    case '7d':
      return { since: daysAgo(7), until, label: 'Últimos 7 días' }
    case '90d':
      return { since: daysAgo(90), until, label: 'Últimos 90 días' }
    case '180d':
      return { since: daysAgo(180), until, label: 'Últimos 180 días' }
    case '365d':
      return { since: daysAgo(365), until, label: 'Último año' }
    case 'month':
      return {
        since: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        until,
        label: 'Este mes',
      }
    case 'last_month':
      return {
        since: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        // Day 0 of the current month resolves to the last day of the previous one.
        until: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
        label: 'Mes pasado',
      }
    case 'ytd':
      return {
        since: toIsoDate(new Date(now.getFullYear(), 0, 1)),
        until,
        label: 'Este año',
      }
    case 'max':
      return { since: metaHistoryFloor(now), until, label: 'Histórico' }
    default:
      return { since: daysAgo(30), until, label: 'Últimos 30 días' }
  }
}

export type MarketingSort =
  | 'spend_desc'
  | 'spend_asc'
  | 'leads_desc'
  | 'cpl_asc'
  | 'ctr_desc'
  | 'name_asc'

const VALID_SORTS: ReadonlySet<MarketingSort> = new Set([
  'spend_desc',
  'spend_asc',
  'leads_desc',
  'cpl_asc',
  'ctr_desc',
  'name_asc',
])

export const SORT_OPTIONS: { value: MarketingSort; label: string }[] = [
  { value: 'spend_desc', label: 'Gasto (mayor)' },
  { value: 'spend_asc', label: 'Gasto (menor)' },
  { value: 'leads_desc', label: 'Leads (mayor)' },
  { value: 'cpl_asc', label: 'CPL (mejor)' },
  { value: 'ctr_desc', label: 'CTR (mejor)' },
  { value: 'name_asc', label: 'Nombre (A→Z)' },
]

export function parseMarketingSort(value: string | string[] | undefined): MarketingSort {
  const v = Array.isArray(value) ? value[0] : value
  return v && VALID_SORTS.has(v as MarketingSort) ? (v as MarketingSort) : 'spend_desc'
}

export function parseShowPaused(value: string | string[] | undefined): boolean {
  const v = Array.isArray(value) ? value[0] : value
  return v === '1' || v === 'true'
}

export type MarketingView = 'ads' | 'campaigns'

const VALID_VIEWS: ReadonlySet<MarketingView> = new Set(['ads', 'campaigns'])

export function parseMarketingView(value: string | string[] | undefined): MarketingView {
  const v = Array.isArray(value) ? value[0] : value
  return v && VALID_VIEWS.has(v as MarketingView) ? (v as MarketingView) : 'ads'
}
