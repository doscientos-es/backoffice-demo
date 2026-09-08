import { describe, expect, it } from 'vitest'

import {
  addDaysIsoLocal,
  computeTrend,
  describeRange,
  getGreeting,
  parseDashboardRange,
  resolveDateRange,
  shortMonthEs,
  todayIsoLocal,
  toIsoDate,
} from '@/lib/utils/date'

describe('shortMonthEs', () => {
  it('returns a localized short month without trailing period', () => {
    expect(shortMonthEs(0)).toBe('ene')
    expect(shortMonthEs(11)).toBe('dic')
    expect(shortMonthEs(0).endsWith('.')).toBe(false)
  })
})

describe('getGreeting', () => {
  it('adapts to the hour of day', () => {
    expect(getGreeting(new Date(2026, 0, 1, 3))).toBe('Buenas noches')
    expect(getGreeting(new Date(2026, 0, 1, 9))).toBe('Buenos días')
    expect(getGreeting(new Date(2026, 0, 1, 15))).toBe('Buenas tardes')
    expect(getGreeting(new Date(2026, 0, 1, 22))).toBe('Buenas noches')
  })
})

describe('parseDashboardRange', () => {
  it('accepts known ranges', () => {
    expect(parseDashboardRange('7d')).toBe('7d')
    expect(parseDashboardRange('90d')).toBe('90d')
    expect(parseDashboardRange('ytd')).toBe('ytd')
  })

  it('defaults to 30d for unknown / missing / array values', () => {
    expect(parseDashboardRange(undefined)).toBe('30d')
    expect(parseDashboardRange('bogus')).toBe('30d')
    expect(parseDashboardRange(['7d', 'x'])).toBe('7d')
  })
})

describe('describeRange', () => {
  it('maps every range to a human label', () => {
    expect(describeRange('7d')).toBe('últimos 7 días')
    expect(describeRange('30d')).toBe('últimos 30 días')
    expect(describeRange('90d')).toBe('últimos 90 días')
    expect(describeRange('ytd')).toBe('este año')
  })
})

describe('computeTrend', () => {
  it('returns flat 0 when both values are zero', () => {
    expect(computeTrend(0, 0)).toEqual({ delta: 0, direction: 'flat' })
  })

  it('returns null when previous is zero but current is not', () => {
    expect(computeTrend(10, 0)).toBeNull()
  })

  it("computes a positive delta and 'up' direction", () => {
    expect(computeTrend(150, 100)).toEqual({ delta: 50, direction: 'up' })
  })

  it("computes a negative delta and 'down' direction", () => {
    expect(computeTrend(50, 100)).toEqual({ delta: -50, direction: 'down' })
  })

  it('uses the magnitude of previous and stays flat within the dead-band', () => {
    // tiny change → |delta| <= 0.5 → flat
    expect(computeTrend(1003, 1000)?.direction).toBe('flat')
    // negative previous handled via Math.abs
    expect(computeTrend(-50, -100)).toEqual({ delta: 50, direction: 'up' })
  })
})

describe('toIsoDate / todayIsoLocal / addDaysIsoLocal', () => {
  it('toIsoDate returns the UTC YYYY-MM-DD slice', () => {
    expect(toIsoDate(new Date('2026-03-09T10:00:00.000Z'))).toBe('2026-03-09')
  })

  it('todayIsoLocal formats local calendar day with zero padding', () => {
    expect(todayIsoLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayIsoLocal(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('addDaysIsoLocal shifts whole days and rolls over months', () => {
    expect(addDaysIsoLocal(1, new Date(2026, 0, 31))).toBe('2026-02-01')
    expect(addDaysIsoLocal(-1, new Date(2026, 0, 1))).toBe('2025-12-31')
    expect(addDaysIsoLocal(7, new Date(2026, 0, 1))).toBe('2026-01-08')
  })
})

describe('resolveDateRange', () => {
  const now = new Date(2026, 4, 15, 12, 0, 0) // 15 May 2026

  it('builds rolling windows of equal length for 30d', () => {
    const { current, previous } = resolveDateRange('30d', now)
    expect(current.to).toBe(now)
    const curLen = current.to.getTime() - current.from.getTime()
    const prevLen = previous.to.getTime() - previous.from.getTime()
    expect(curLen).toBe(prevLen)
    // previous window ends exactly where the current one starts
    expect(previous.to.getTime()).toBe(current.from.getTime())
  })

  it('uses 7 days for the 7d range', () => {
    const { current } = resolveDateRange('7d', now)
    const days = (current.to.getTime() - current.from.getTime()) / 86_400_000
    expect(days).toBe(7)
  })

  it('ytd starts on Jan 1 and compares with the same span last year', () => {
    const { current, previous } = resolveDateRange('ytd', now)
    expect(current.from.getFullYear()).toBe(2026)
    expect(current.from.getMonth()).toBe(0)
    expect(current.from.getDate()).toBe(1)
    expect(previous.from.getFullYear()).toBe(2025)
    expect(previous.to.getFullYear()).toBe(2025)
    expect(previous.to.getMonth()).toBe(now.getMonth())
    expect(previous.to.getDate()).toBe(now.getDate())
  })
})
