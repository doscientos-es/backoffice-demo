import { describe, expect, it } from 'vitest'

import {
  FINANCE_RANGE_OPTIONS,
  type FinanceRange,
  financeRangeToDates,
  parseFinanceRange,
} from '@/lib/finance/range'

const ISO = /^\d{4}-\d{2}-\d{2}$/

describe('parseFinanceRange', () => {
  it('returns the value when valid', () => {
    expect(parseFinanceRange('ytd')).toBe('ytd')
    expect(parseFinanceRange('90d')).toBe('90d')
  })
  it('unwraps an array of search params', () => {
    expect(parseFinanceRange(['last_month', 'ytd'])).toBe('last_month')
  })
  it("falls back to 'month' for invalid or missing values", () => {
    expect(parseFinanceRange(undefined)).toBe('month')
    expect(parseFinanceRange('nope')).toBe('month')
    expect(parseFinanceRange([])).toBe('month')
  })
})

describe('FINANCE_RANGE_OPTIONS', () => {
  it('lists every range with a label', () => {
    const values = FINANCE_RANGE_OPTIONS.map((o) => o.value)
    expect(values).toEqual(['month', 'last_month', 'ytd', '90d', '365d', 'max'])
    for (const o of FINANCE_RANGE_OPTIONS) expect(o.label.length).toBeGreaterThan(0)
  })
})

describe('financeRangeToDates', () => {
  const ranges: FinanceRange[] = ['month', 'last_month', 'ytd', '90d', '365d', 'max']

  it('returns ISO dates and a label for every range', () => {
    for (const range of ranges) {
      const r = financeRangeToDates(range)
      expect(r.since).toMatch(ISO)
      expect(r.until).toMatch(ISO)
      expect(r.label.length).toBeGreaterThan(0)
      expect(r.since <= r.until).toBe(true)
    }
  })

  // `since` is built from a local-time Date and serialised via toISOString()
  // (UTC), so we derive the expectation with the same formula to stay
  // timezone-agnostic instead of asserting a literal "-01" suffix.
  const iso = (d: Date) => d.toISOString().split('T')[0]

  it('month starts on the first of the current month', () => {
    const now = new Date()
    const r = financeRangeToDates('month')
    expect(r.since).toBe(iso(new Date(now.getFullYear(), now.getMonth(), 1)))
  })

  it('ytd starts on Jan 1st', () => {
    const now = new Date()
    expect(financeRangeToDates('ytd').since).toBe(iso(new Date(now.getFullYear(), 0, 1)))
  })

  it('max starts at the historical floor', () => {
    expect(financeRangeToDates('max').since).toBe('2000-01-01')
  })

  it('last_month ends before this month starts', () => {
    const last = financeRangeToDates('last_month')
    const month = financeRangeToDates('month')
    expect(last.until < month.since).toBe(true)
  })
})
