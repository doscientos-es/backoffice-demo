import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MEETING_DURATION,
  MEETING_DURATIONS,
  defaultMeetingStart,
} from '@/lib/calendar/date-presets'

describe('calendar date presets', () => {
  const now = new Date(2026, 0, 31, 15, 45)

  it('suggests tomorrow at 10:00', () => {
    expect(defaultMeetingStart(now)).toBe('2026-02-01T10:00')
  })

  it('offers the supported durations with one hour by default', () => {
    expect(MEETING_DURATIONS).toEqual([15, 30, 60, 120])
    expect(DEFAULT_MEETING_DURATION).toBe(60)
  })
})
