import type { DashboardRange, DateRange, Trend, TrendDirection } from '@/lib/dashboard/types'

const SHORT_MONTH_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short' })

/**
 * Localized short month label without trailing period.
 * Example: 0 → "ene", 11 → "dic".
 */
export function shortMonthEs(monthIndex: number): string {
  const sample = new Date(2024, monthIndex, 1)
  return SHORT_MONTH_FMT.format(sample).replace(/\.$/, '')
}

/**
 * Greeting that adapts to the local time of day.
 */
export function getGreeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

/**
 * Builds the current + previous comparison windows for a given range.
 * The previous window has the same length and ends just before the current one.
 *
 * - 7d / 30d / 90d → rolling windows ending now.
 * - ytd → from Jan 1st of the current year to now, compared with the same span
 *   in the previous year.
 */
export function resolveDateRange(range: DashboardRange, now: Date = new Date()): DateRange {
  const to = now
  let from: Date

  if (range === 'ytd') {
    from = new Date(now.getFullYear(), 0, 1)
    const prevFrom = new Date(now.getFullYear() - 1, 0, 1)
    const prevTo = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    )
    return { current: { from, to }, previous: { from: prevFrom, to: prevTo } }
  }

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  from = new Date(to.getTime() - days * 86_400_000)
  const prevTo = new Date(from.getTime())
  const prevFrom = new Date(from.getTime() - days * 86_400_000)
  return { current: { from, to }, previous: { from: prevFrom, to: prevTo } }
}

/**
 * Parses ?range= into a known DashboardRange (defaults to 30d).
 */
export function parseDashboardRange(value: string | string[] | undefined): DashboardRange {
  const v = Array.isArray(value) ? value[0] : value
  return v === '7d' || v === '30d' || v === '90d' || v === 'ytd' ? v : '30d'
}

/**
 * Computes the percentage delta between a current and previous value.
 * Returns null when the previous value is zero (delta is undefined).
 */
export function computeTrend(current: number, previous: number): Trend | null {
  if (previous === 0) {
    if (current === 0) return { delta: 0, direction: 'flat' }
    return null
  }
  const ratio = (current - previous) / Math.abs(previous)
  const delta = Math.round(ratio * 1000) / 10 // one decimal
  const direction: TrendDirection = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat'
  return { delta, direction }
}

/**
 * Short ISO date (YYYY-MM-DD) helper for Supabase date columns.
 */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Local-time short ISO date (YYYY-MM-DD). Preferred for form prefills so the
 * suggested value matches the user's calendar day instead of the UTC day
 * (which `toIsoDate` returns and can be off by one near midnight).
 */
export function todayIsoLocal(base: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
}

/**
 * Adds whole days to `base` and returns the result as a local-time YYYY-MM-DD
 * string. Useful for suggesting end dates relative to today.
 */
export function addDaysIsoLocal(days: number, base: Date = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return todayIsoLocal(d)
}

/**
 * Range label suitable for chart titles and KPI hints.
 */
export function describeRange(range: DashboardRange): string {
  switch (range) {
    case '7d':
      return 'últimos 7 días'
    case '30d':
      return 'últimos 30 días'
    case '90d':
      return 'últimos 90 días'
    case 'ytd':
      return 'este año'
  }
}
