import { describe, expect, it } from 'vitest'

import { suggestedCallDurationMinutes } from './meeting-duration'

const now = new Date(2026, 7, 17, 14, 0)

describe('suggestedCallDurationMinutes', () => {
  it('uses the most recent meeting scheduled earlier today', () => {
    expect(
      suggestedCallDurationMinutes(
        [
          {
            type: 'meeting',
            payload: { start: '2026-08-17T09:00:00', end: '2026-08-17T09:30:00' },
          },
          {
            type: 'meeting',
            payload: { start: '2026-08-17T11:00:00', end: '2026-08-17T11:45:00' },
          },
        ],
        now,
      ),
    ).toBe(45)
  })

  it('ignores future, past-day, malformed, and unsupported meeting durations', () => {
    expect(
      suggestedCallDurationMinutes(
        [
          {
            type: 'meeting',
            payload: { start: '2026-08-17T16:00:00', end: '2026-08-17T17:00:00' },
          },
          {
            type: 'meeting',
            payload: { start: '2026-08-16T10:00:00', end: '2026-08-16T11:00:00' },
          },
          { type: 'meeting', payload: { start: 'invalid', end: '2026-08-17T11:00:00' } },
          {
            type: 'meeting',
            payload: { start: '2026-08-17T08:00:00', end: '2026-08-17T19:00:00' },
          },
        ],
        now,
      ),
    ).toBeNull()
  })
})
