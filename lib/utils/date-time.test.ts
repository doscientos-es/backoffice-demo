import { describe, expect, it } from 'vitest'

import {
  addMinutesToDatetimeLocal,
  dateAndTimeToIso,
  datetimeLocalToIso,
  toDatetimeLocalValue,
} from '@/lib/utils/date-time'

describe('toDatetimeLocalValue', () => {
  it('formats local date and time without seconds', () => {
    expect(toDatetimeLocalValue(new Date(2026, 0, 5, 9, 7, 42))).toBe('2026-01-05T09:07')
  })
})

describe('datetimeLocalToIso / dateAndTimeToIso', () => {
  it("converts local values to the runtime timezone's UTC representation", () => {
    const localValue = '2026-03-09T10:30'
    expect(datetimeLocalToIso(localValue)).toBe(new Date(localValue).toISOString())
    expect(dateAndTimeToIso('2026-03-09', '10:30')).toBe(new Date(localValue).toISOString())
  })

  it('rejects invalid values', () => {
    expect(() => datetimeLocalToIso('not-a-date')).toThrow(RangeError)
  })
})

describe('addMinutesToDatetimeLocal', () => {
  it('rolls over the day when adding time', () => {
    expect(addMinutesToDatetimeLocal('2026-01-31T23:30', 60)).toBe('2026-02-01T00:30')
  })
})
