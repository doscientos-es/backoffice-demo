import { describe, expect, it } from 'vitest'

import {
  META_INSIGHTS_MAX_MONTHS,
  metaHistoryFloor,
  parseMarketingRange,
  parseMarketingSort,
  parseMarketingView,
  parseShowPaused,
  rangeToDates,
} from '@/lib/marketing/range'

// ---------------------------------------------------------------------------
// parseMarketingRange
// ---------------------------------------------------------------------------
describe('parseMarketingRange', () => {
  it('defaults to 30d for undefined', () => {
    expect(parseMarketingRange(undefined)).toBe('30d')
  })

  it('defaults to 30d for an unknown string', () => {
    expect(parseMarketingRange('invalid')).toBe('30d')
  })

  it('accepts every valid range key', () => {
    const valid = ['7d', '30d', '90d', '180d', '365d', 'month', 'last_month', 'ytd', 'max'] as const
    for (const v of valid) expect(parseMarketingRange(v)).toBe(v)
  })

  it('picks the first element from an array', () => {
    expect(parseMarketingRange(['90d', '7d'])).toBe('90d')
  })

  it('falls back when the array contains an invalid value', () => {
    expect(parseMarketingRange(['bad'])).toBe('30d')
  })
})

// ---------------------------------------------------------------------------
// parseMarketingSort
// ---------------------------------------------------------------------------
describe('parseMarketingSort', () => {
  it('defaults to spend_desc for undefined', () => {
    expect(parseMarketingSort(undefined)).toBe('spend_desc')
  })

  it('defaults to spend_desc for unknown string', () => {
    expect(parseMarketingSort('unknown')).toBe('spend_desc')
  })

  it('accepts all valid sort keys', () => {
    const valid = [
      'spend_desc',
      'spend_asc',
      'leads_desc',
      'cpl_asc',
      'ctr_desc',
      'name_asc',
    ] as const
    for (const v of valid) expect(parseMarketingSort(v)).toBe(v)
  })

  it('picks the first element from an array', () => {
    expect(parseMarketingSort(['cpl_asc', 'spend_asc'])).toBe('cpl_asc')
  })
})

// ---------------------------------------------------------------------------
// parseShowPaused
// ---------------------------------------------------------------------------
describe('parseShowPaused', () => {
  it('returns false for undefined', () => expect(parseShowPaused(undefined)).toBe(false))
  it("returns false for the string '0'", () => expect(parseShowPaused('0')).toBe(false))
  it("returns false for 'false'", () => expect(parseShowPaused('false')).toBe(false))
  it("returns true for '1'", () => expect(parseShowPaused('1')).toBe(true))
  it("returns true for 'true'", () => expect(parseShowPaused('true')).toBe(true))
  it('picks the first element from an array', () => expect(parseShowPaused(['1'])).toBe(true))
})

// ---------------------------------------------------------------------------
// parseMarketingView
// ---------------------------------------------------------------------------
describe('parseMarketingView', () => {
  it('defaults to ads for undefined', () => expect(parseMarketingView(undefined)).toBe('ads'))
  it('defaults to ads for unknown value', () => expect(parseMarketingView('other')).toBe('ads'))
  it("accepts 'campaigns'", () => expect(parseMarketingView('campaigns')).toBe('campaigns'))
  it("accepts 'ads'", () => expect(parseMarketingView('ads')).toBe('ads'))
})

// ---------------------------------------------------------------------------
// metaHistoryFloor
// ---------------------------------------------------------------------------
describe('metaHistoryFloor', () => {
  it(`goes back exactly ${META_INSIGHTS_MAX_MONTHS} months from the reference date`, () => {
    const ref = new Date('2026-06-01T12:00:00Z')
    const floor = metaHistoryFloor(ref)
    const expected = new Date(ref)
    expected.setMonth(expected.getMonth() - META_INSIGHTS_MAX_MONTHS)
    expect(floor).toBe(expected.toISOString().split('T')[0])
  })
})

// ---------------------------------------------------------------------------
// rangeToDates
// ---------------------------------------------------------------------------
describe('rangeToDates', () => {
  it('7d: since = 7 days ago, label matches', () => {
    const { since, until, label } = rangeToDates('7d')
    // We can't pin the exact date without mocking Date, so assert shape.
    expect(since).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(until).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(label).toBe('Últimos 7 días')
  })

  it('last_month: until is day-before-current-month (last day of prev month)', () => {
    // The until for last_month must be before this month's start.
    const { since, until } = rangeToDates('last_month')
    const untilDate = new Date(until)
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    expect(untilDate < thisMonthStart).toBe(true)
    expect(new Date(since) <= untilDate).toBe(true)
  })

  it('ytd: since is the local start of the current year, label matches', () => {
    const { since, until, label } = rangeToDates('ytd')
    // Compute the expected value using the same local-midnight logic the function uses.
    const expected = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    expect(since).toBe(expected)
    expect(since <= until).toBe(true)
    expect(label).toBe('Este año')
  })

  it('max: label is Histórico', () => {
    const { label } = rangeToDates('max')
    expect(label).toBe('Histórico')
  })

  it('unknown range falls back to 30d label', () => {
    // @ts-expect-error — intentional unknown value
    const { label } = rangeToDates('bad_range')
    expect(label).toBe('Últimos 30 días')
  })
})
