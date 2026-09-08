import { describe, expect, it } from 'vitest'

import { buildInvoiceItemRows, getMonthlyBillingWindow, isRectifiableInvoice } from './workflows'

describe('invoice workflow rules', () => {
  it('calculates a half-open monthly billing window', () => {
    expect(getMonthlyBillingWindow('2026-02')).toEqual({ start: '2026-02-01', end: '2026-03-01' })
  })

  it('preserves invoice line order and protects rectification eligibility', () => {
    expect(
      buildInvoiceItemRows([
        { description: 'Servicio', quantity: 1, unit_price: 100, vat_rate: 21 },
      ]),
    ).toEqual([
      { position: 0, description: 'Servicio', quantity: 1, unit_price: 100, vat_rate: 21 },
    ])
    expect(isRectifiableInvoice({ status: 'paid', isRectification: false })).toBe(true)
    expect(isRectifiableInvoice({ status: 'draft', isRectification: false })).toBe(false)
    expect(isRectifiableInvoice({ status: 'issued', isRectification: true })).toBe(false)
  })
})
