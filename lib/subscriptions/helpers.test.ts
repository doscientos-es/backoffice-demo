import { describe, expect, it } from 'vitest'

import { advanceDate } from './helpers'

describe('advanceDate', () => {
  describe('monthly', () => {
    it('advances a normal date by one month', () => {
      expect(advanceDate('2024-03-15', 'monthly')).toBe('2024-04-15')
    })

    it('produces a new monthly billing date after every generated invoice', () => {
      const firstInvoiceDate = '2024-01-15'
      const secondInvoiceDate = advanceDate(firstInvoiceDate, 'monthly')
      const thirdInvoiceDate = advanceDate(secondInvoiceDate, 'monthly')

      expect([firstInvoiceDate, secondInvoiceDate, thirdInvoiceDate]).toEqual([
        '2024-01-15',
        '2024-02-15',
        '2024-03-15',
      ])
    })

    it('clamps Jan 31 to Feb 28 on a non-leap year', () => {
      expect(advanceDate('2025-01-31', 'monthly')).toBe('2025-02-28')
    })

    it('clamps Jan 31 to Feb 29 on a leap year', () => {
      expect(advanceDate('2024-01-31', 'monthly')).toBe('2024-02-29')
    })

    it('clamps Mar 31 to Apr 30', () => {
      expect(advanceDate('2024-03-31', 'monthly')).toBe('2024-04-30')
    })

    it('rolls over from December to January of the next year', () => {
      expect(advanceDate('2024-12-15', 'monthly')).toBe('2025-01-15')
    })

    it('clamps Dec 31 to Jan 31 (no overflow)', () => {
      expect(advanceDate('2024-12-31', 'monthly')).toBe('2025-01-31')
    })
  })

  describe('quarterly', () => {
    it('advances by three months', () => {
      expect(advanceDate('2024-01-15', 'quarterly')).toBe('2024-04-15')
    })

    it('clamps Nov 30 to Feb 28 on a non-leap year', () => {
      expect(advanceDate('2025-11-30', 'quarterly')).toBe('2026-02-28')
    })

    it('clamps Nov 30 to Feb 29 on a leap year', () => {
      expect(advanceDate('2023-11-30', 'quarterly')).toBe('2024-02-29')
    })

    it('rolls over across the year boundary', () => {
      expect(advanceDate('2024-11-01', 'quarterly')).toBe('2025-02-01')
    })
  })

  describe('yearly', () => {
    it('advances by one year', () => {
      expect(advanceDate('2024-06-15', 'yearly')).toBe('2025-06-15')
    })

    it('clamps Feb 29 to Feb 28 on the next non-leap year', () => {
      expect(advanceDate('2024-02-29', 'yearly')).toBe('2025-02-28')
    })

    it('keeps Feb 29 on the next leap year', () => {
      expect(advanceDate('2024-02-29', 'yearly')).toBe('2025-02-28')
      // 2028 is a leap year
      expect(advanceDate('2027-02-28', 'yearly')).toBe('2028-02-28')
    })
  })

  describe('unknown cycle', () => {
    it('returns the original date unchanged for an unknown cycle', () => {
      expect(advanceDate('2024-05-10', 'biweekly')).toBe('2024-05-10')
    })
  })
})
