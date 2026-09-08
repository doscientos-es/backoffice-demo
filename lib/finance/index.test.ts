import { describe, expect, it } from 'vitest'

import {
  buildMonthlySeries,
  computeExpenseTotals,
  computeProposalTotals,
  profitMargin,
} from '@/lib/finance'

describe('computeExpenseTotals', () => {
  it('computes tax and total with 21% IVA', () => {
    const r = computeExpenseTotals(100, 21)
    expect(r.subtotal).toBe(100)
    expect(r.taxAmount).toBe(21)
    expect(r.total).toBe(121)
  })

  it('handles 0% tax rate', () => {
    const r = computeExpenseTotals(50, 0)
    expect(r.taxAmount).toBe(0)
    expect(r.total).toBe(50)
  })

  it('rounds to 2 decimals', () => {
    const r = computeExpenseTotals(33.333, 21)
    expect(r.subtotal).toBe(33.33)
    expect(r.taxAmount).toBeCloseTo(7, 1)
    expect(r.total).toBeCloseTo(40.33, 1)
  })

  it('coerces non-finite inputs to zero', () => {
    const r = computeExpenseTotals(Number.NaN, Number.POSITIVE_INFINITY)
    expect(r.subtotal).toBe(0)
    expect(r.taxAmount).toBe(0)
    expect(r.total).toBe(0)
  })
})

describe('profitMargin', () => {
  it('returns null when revenue is 0', () => {
    expect(profitMargin(0, 10)).toBeNull()
  })

  it('computes positive margin', () => {
    expect(profitMargin(1000, 400)).toBe(60)
  })

  it('can be negative when expense > revenue', () => {
    expect(profitMargin(100, 250)).toBe(-150)
  })
})

describe('buildMonthlySeries', () => {
  const ref = new Date(2026, 4, 15) // 15 May 2026

  it('returns 6 months ending at the reference month', () => {
    const series = buildMonthlySeries([], [], ref)
    expect(series).toHaveLength(6)
    // Last point is May (mes índice 4 -> "may")
    expect(series.at(-1)?.month).toBe('may')
    // First point is December of previous year
    expect(series[0]?.month).toBe('dic')
  })

  it('aggregates revenue and expense by month', () => {
    const revenue = [
      { date: '2026-05-02', total: 100 },
      { date: '2026-05-20', total: 50 },
      { date: '2026-03-10', total: 200 },
    ]
    const expense = [
      { date: '2026-05-04', total: 30 },
      { date: '2026-04-04', total: 10 },
    ]
    const series = buildMonthlySeries(revenue, expense, ref)
    const may = series.find((s) => s.month === 'may')
    const apr = series.find((s) => s.month === 'abr')
    const mar = series.find((s) => s.month === 'mar')
    expect(may).toMatchObject({ revenue: 150, expense: 30, net: 120 })
    expect(apr).toMatchObject({ revenue: 0, expense: 10, net: -10 })
    expect(mar).toMatchObject({ revenue: 200, expense: 0, net: 200 })
  })

  it('ignores rows outside the 6-month window', () => {
    const revenue = [{ date: '2025-01-01', total: 9999 }]
    const series = buildMonthlySeries(revenue, [], ref)
    const total = series.reduce((a, p) => a + p.revenue, 0)
    expect(total).toBe(0)
  })

  it('accepts Date objects as input', () => {
    const series = buildMonthlySeries([{ date: new Date(2026, 4, 1), total: 42 }], [], ref)
    expect(series.at(-1)?.revenue).toBe(42)
  })
})

describe('computeProposalTotals', () => {
  it('returns zeroed buckets for an empty list', () => {
    const r = computeProposalTotals([])
    expect(r.oneTime).toEqual({ subtotal: 0, taxAmount: 0, total: 0 })
    expect(r.monthly).toEqual({ subtotal: 0, taxAmount: 0, total: 0 })
    expect(r.quarterly).toEqual({ subtotal: 0, taxAmount: 0, total: 0 })
    expect(r.yearly).toEqual({ subtotal: 0, taxAmount: 0, total: 0 })
    expect(r.grand).toEqual({ subtotal: 0, taxAmount: 0, total: 0 })
  })

  it('treats missing billing_cycle as one-time', () => {
    const r = computeProposalTotals([{ quantity: 2, unit_price: 50, vat_rate: 21 }])
    expect(r.oneTime).toEqual({ subtotal: 100, taxAmount: 21, total: 121 })
    expect(r.monthly.total).toBe(0)
    expect(r.grand.total).toBe(121)
  })

  it('buckets each cadence independently and keeps recurring per-period', () => {
    const r = computeProposalTotals([
      { quantity: 1, unit_price: 1000, vat_rate: 21, billing_cycle: 'none' },
      { quantity: 1, unit_price: 200, vat_rate: 21, billing_cycle: 'monthly' },
      { quantity: 2, unit_price: 100, vat_rate: 21, billing_cycle: 'quarterly' },
      { quantity: 1, unit_price: 500, vat_rate: 10, billing_cycle: 'yearly' },
    ])
    expect(r.oneTime).toEqual({ subtotal: 1000, taxAmount: 210, total: 1210 })
    expect(r.monthly).toEqual({ subtotal: 200, taxAmount: 42, total: 242 })
    expect(r.quarterly).toEqual({ subtotal: 200, taxAmount: 42, total: 242 })
    expect(r.yearly).toEqual({ subtotal: 500, taxAmount: 50, total: 550 })
    expect(r.grand).toEqual({
      subtotal: 1900,
      taxAmount: 344,
      total: 2244,
    })
  })

  it('aggregates multiple lines sharing the same cadence', () => {
    const r = computeProposalTotals([
      { quantity: 1, unit_price: 100, vat_rate: 21, billing_cycle: 'monthly' },
      { quantity: 3, unit_price: 50, vat_rate: 21, billing_cycle: 'monthly' },
    ])
    expect(r.monthly.subtotal).toBe(250)
    expect(r.monthly.taxAmount).toBeCloseTo(52.5, 2)
    expect(r.monthly.total).toBeCloseTo(302.5, 2)
  })

  it('falls back to one-time on an unknown billing_cycle value', () => {
    const r = computeProposalTotals([
      // @ts-expect-error — exercising the runtime guard
      { quantity: 1, unit_price: 100, vat_rate: 21, billing_cycle: 'weekly' },
    ])
    expect(r.oneTime.total).toBe(121)
    expect(r.monthly.total).toBe(0)
  })

  it('treats null billing_cycle as one-time', () => {
    const r = computeProposalTotals([
      { quantity: 1, unit_price: 80, vat_rate: 10, billing_cycle: null },
    ])
    expect(r.oneTime).toEqual({ subtotal: 80, taxAmount: 8, total: 88 })
  })

  it('coerces NaN numeric inputs to zero', () => {
    const r = computeProposalTotals([
      {
        quantity: Number.NaN,
        unit_price: Number.NaN,
        vat_rate: Number.NaN,
        billing_cycle: 'monthly',
      },
    ])
    expect(r.monthly).toEqual({ subtotal: 0, taxAmount: 0, total: 0 })
    expect(r.grand.total).toBe(0)
  })
})
