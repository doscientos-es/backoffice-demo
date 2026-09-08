import { describe, expect, it, vi } from 'vitest'

const googleFetch = vi.hoisted(() => vi.fn())

vi.mock('./client', () => ({
  GOOGLE_SCOPES: { calendar: 'https://www.googleapis.com/auth/calendar' },
  googleFetch,
}))

import { insertEvent } from './calendar'

describe('insertEvent', () => {
  it('uses the video conference entry point when hangoutLink is absent', async () => {
    googleFetch.mockResolvedValueOnce({
      id: 'event-1',
      conferenceData: {
        entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }],
      },
    })

    await expect(
      insertEvent({
        subject: 'pol@doscientos.es',
        calendarId: 'team-calendar',
        summary: 'Reunión',
        start: new Date('2026-08-10T10:00:00.000Z'),
        end: new Date('2026-08-10T11:00:00.000Z'),
        withMeet: true,
      }),
    ).resolves.toMatchObject({ meetUrl: 'https://meet.google.com/abc-defg-hij' })

    expect(googleFetch).toHaveBeenCalledWith(
      'pol@doscientos.es',
      ['https://www.googleapis.com/auth/calendar'],
      expect.stringContaining('conferenceDataVersion=1'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
