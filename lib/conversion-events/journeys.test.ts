import { describe, expect, it } from 'vitest'

import { findClarityPlaybackUrl, groupIntoJourneys, trafficSource } from './journeys'
import type { ConversionEventRow } from './queries'

function event(overrides: Partial<ConversionEventRow> = {}): ConversionEventRow {
  return {
    id: 1,
    event_id: null,
    visitor_id: 'visitor-1',
    lead_id: null,
    event_name: 'page_view',
    conversion_step: null,
    landing_path: '/',
    landing_ref: null,
    referrer: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    ip: null,
    user_agent: 'Mozilla/5.0',
    payload: null,
    created_at: '2026-08-06T10:00:00.000Z',
    lead: null,
    ...overrides,
  }
}

describe('groupIntoJourneys', () => {
  it('groups events by visitor and exposes a valid Clarity playback URL', () => {
    const journeys = groupIntoJourneys([
      event({ id: 1, created_at: '2026-08-06T10:00:00.000Z' }),
      event({
        id: 2,
        event_name: 'calculator_used',
        created_at: '2026-08-06T10:01:00.000Z',
        payload: {
          clarity_url: 'https://clarity.microsoft.com/player/project/user/session',
        },
      }),
    ])

    expect(journeys).toHaveLength(1)
    expect(journeys[0]?.events).toHaveLength(2)
    expect(journeys[0]?.clarityUrl).toBe(
      'https://clarity.microsoft.com/player/project/user/session',
    )
  })

  it('ignores malformed Clarity URLs', () => {
    const [journey] = groupIntoJourneys([
      event({ payload: { clarity_url: 'https://example.com/session' } }),
    ])

    expect(journey?.clarityUrl).toBeNull()
  })

  it("only accepts playback URLs from Clarity's domain", () => {
    expect(
      findClarityPlaybackUrl([
        event({ payload: { clarity_url: 'https://clarity.microsoft.com.evil.test/player' } }),
      ]),
    ).toBeNull()
  })
})

describe('trafficSource', () => {
  it('prioritizes campaign parameters', () => {
    expect(
      trafficSource({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer',
        referrer: 'https://example.com',
      }),
    ).toBe('google / cpc · summer')
  })
})
