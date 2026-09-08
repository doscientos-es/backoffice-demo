import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insertEvent } = vi.hoisted(() => ({
  insertEvent: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireUser: async () => ({ id: 'member-1', name: 'Ana', email: 'ana@example.com' }),
}))
vi.mock('@/lib/env', () => ({
  isGoogleEnabled: () => true,
  serverEnv: () => ({ GOOGLE_CALENDAR_ID: 'team-calendar' }),
}))
vi.mock('@/lib/google/calendar', () => ({ deleteEvent: vi.fn(), insertEvent }))
vi.mock('@/lib/google/client', () => ({ resolveSubject: () => 'ana@example.com' }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({}) }))

import { createCalendarEvent } from './actions'

describe('createCalendarEvent', () => {
  beforeEach(() => {
    insertEvent.mockClear()
    insertEvent.mockResolvedValue({ id: 'event-1', htmlLink: null, meetUrl: null })
  })

  it('calculates a meeting end from the selected duration across midnight', async () => {
    const result = await createCalendarEvent({
      kind: 'google_meeting',
      title: 'Reunión de prueba',
      date: '2026-01-31',
      startTime: '23:30',
      durationMinutes: 60,
    })

    const [{ start, end }] = insertEvent.mock.calls[0] as [{ start: Date; end: Date }]
    expect(end.getTime() - start.getTime()).toBe(60 * 60_000)
    expect(result).toMatchObject({
      ok: true,
      event: { start: start.toISOString(), end: end.toISOString() },
    })
  })

  it('uses a 60-minute duration when none is specified', async () => {
    await createCalendarEvent({
      kind: 'google_meeting',
      title: 'Reunión de prueba',
      date: '2026-02-01',
      startTime: '10:00',
    })

    const [{ start, end }] = insertEvent.mock.calls[0] as [{ start: Date; end: Date }]
    expect(end.getTime() - start.getTime()).toBe(60 * 60_000)
  })
})
