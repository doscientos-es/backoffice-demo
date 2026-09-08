import { describe, expect, it } from 'vitest'

import {
  defaultFollowUpDateTime,
  defaultReminderDateTime,
  suggestedReminderDateTime,
} from '@/lib/reminders/date-presets'
import { toDatetimeLocalValue } from '@/lib/utils/date-time'

describe('reminder date presets', () => {
  const now = new Date(2026, 0, 31, 15, 45, 30)

  it('rounds the default reminder to the next hour', () => {
    expect(defaultReminderDateTime(now)).toBe('2026-01-31T16:00')
  })

  it('suggests a follow-up for tomorrow at 09:00', () => {
    expect(defaultFollowUpDateTime(now)).toBe('2026-02-01T09:00')
  })

  it('formats valid suggestions and falls back for invalid values', () => {
    expect(suggestedReminderDateTime('2026-02-01T12:30:00.000Z', now)).toBe(
      toDatetimeLocalValue(new Date('2026-02-01T12:30:00.000Z')),
    )
    expect(suggestedReminderDateTime('invalid', now)).toBe('2026-01-31T16:00')
  })
})
