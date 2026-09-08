/** URL-driven date windows for the lead analytics dashboard. Client-safe: this
 * module deliberately has no database or server-only imports. */
export type LeadAnalyticsRange = '30d' | '90d' | '180d' | '365d' | 'ytd' | 'all'

export const LEAD_ANALYTICS_RANGE_OPTIONS: ReadonlyArray<{
  value: LeadAnalyticsRange
  label: string
}> = [
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: '180d', label: 'Últimos 180 días' },
  { value: '365d', label: 'Último año' },
  { value: 'ytd', label: 'Este año' },
  { value: 'all', label: 'Histórico' },
]

const ANALYTICS_RANGES = new Set<LeadAnalyticsRange>(
  LEAD_ANALYTICS_RANGE_OPTIONS.map((option) => option.value),
)

export function parseLeadAnalyticsRange(value: string | string[] | undefined): LeadAnalyticsRange {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate && ANALYTICS_RANGES.has(candidate as LeadAnalyticsRange)
    ? (candidate as LeadAnalyticsRange)
    : '90d'
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function leadAnalyticsRangeToDates(range: LeadAnalyticsRange, now = new Date()) {
  const until = isoDate(now)
  const daysAgo = (days: number) => isoDate(new Date(now.getTime() - days * 86_400_000))

  switch (range) {
    case '30d':
      return { since: daysAgo(30), until, label: 'Últimos 30 días' }
    case '180d':
      return { since: daysAgo(180), until, label: 'Últimos 180 días' }
    case '365d':
      return { since: daysAgo(365), until, label: 'Último año' }
    case 'ytd':
      return { since: isoDate(new Date(now.getFullYear(), 0, 1)), until, label: 'Este año' }
    case 'all':
      return { since: '2000-01-01', until, label: 'Histórico' }
    default:
      return { since: daysAgo(90), until, label: 'Últimos 90 días' }
  }
}
