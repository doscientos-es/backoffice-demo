import { describe, expect, it } from 'vitest'

import { displayToIso, isoToDisplay, maskDate } from '@/lib/utils/date-field'

// ─── isoToDisplay ─────────────────────────────────────────────────────────────

describe('isoToDisplay', () => {
  it('converts a valid ISO date to dd/MM/yyyy', () => {
    expect(isoToDisplay('2024-03-15')).toBe('15/03/2024')
  })

  it('returns empty string for empty input', () => {
    expect(isoToDisplay('')).toBe('')
  })

  it('returns empty string for invalid ISO', () => {
    expect(isoToDisplay('not-a-date')).toBe('')
  })

  it('handles leap year correctly', () => {
    expect(isoToDisplay('2024-02-29')).toBe('29/02/2024')
  })

  it('handles last day of year', () => {
    expect(isoToDisplay('2023-12-31')).toBe('31/12/2023')
  })

  it('returns empty string for partial ISO', () => {
    expect(isoToDisplay('2024-03')).toBe('')
  })
})

// ─── displayToIso ─────────────────────────────────────────────────────────────

describe('displayToIso', () => {
  it('converts dd/MM/yyyy to ISO yyyy-MM-dd', () => {
    expect(displayToIso('15/03/2024')).toBe('2024-03-15')
  })

  it('returns empty string for empty input', () => {
    expect(displayToIso('')).toBe('')
  })

  it('returns empty string for partial input', () => {
    expect(displayToIso('15/03')).toBe('')
    expect(displayToIso('15/03/')).toBe('')
    expect(displayToIso('15/0')).toBe('')
  })

  it('accepts valid leap year date', () => {
    expect(displayToIso('29/02/2024')).toBe('2024-02-29')
  })

  it('rejects 29 Feb on a non-leap year', () => {
    // date-fns rolls 29/02/2023 → 01/03/2023; round-trip validation rejects it
    expect(displayToIso('29/02/2023')).toBe('')
  })

  it('rejects overflow day 31 in a 30-day month', () => {
    expect(displayToIso('31/04/2024')).toBe('')
  })

  it('rejects month 13', () => {
    expect(displayToIso('01/13/2024')).toBe('')
  })

  it('rejects day 00', () => {
    expect(displayToIso('00/01/2024')).toBe('')
  })

  it('returns empty string for completely invalid text', () => {
    expect(displayToIso('abcdefghij')).toBe('')
  })
})

// ─── maskDate ─────────────────────────────────────────────────────────────────

describe('maskDate', () => {
  it('adds separator after 2 digits', () => {
    expect(maskDate('15')).toBe('15')
    expect(maskDate('153')).toBe('15/3')
  })

  it('adds two separators for a full date', () => {
    expect(maskDate('15032024')).toBe('15/03/2024')
  })

  it('strips non-digit characters', () => {
    expect(maskDate('15-03-2024')).toBe('15/03/2024')
  })

  it('limits to 8 significant digits (10 chars with separators)', () => {
    expect(maskDate('150320249999')).toBe('15/03/2024')
  })

  it('returns empty string for empty input', () => {
    expect(maskDate('')).toBe('')
  })

  it('handles pasted ISO date by stripping dashes', () => {
    // "2024-03-15" → 8 digits "20240315" → day=20, month=24, year=0315
    // Result is an invalid display date; displayToIso will reject it with ""
    expect(maskDate('2024-03-15')).toBe('20/24/0315')
  })

  it('handles a single digit', () => {
    expect(maskDate('1')).toBe('1')
  })
})
