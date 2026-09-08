import { describe, expect, it } from 'vitest'

import { csvWithBom, quarterlyPeriod } from './quarterly-invoices'

describe('quarterly invoice export helpers', () => {
  it('resolves a calendar quarter with exclusive end date', () => {
    expect(quarterlyPeriod('2026', '3')).toMatchObject({
      start: '2026-07-01',
      end: '2026-10-01',
      label: 'T3 2026',
    })
    expect(quarterlyPeriod('2026', '5')).toBeNull()
  })

  it('keeps requested CSV headers when the period has no rows', () => {
    const csv = new TextDecoder().decode(csvWithBom([], ['Tipo', 'Total']))

    expect(csv).toContain('"Tipo","Total"')
  })
})
