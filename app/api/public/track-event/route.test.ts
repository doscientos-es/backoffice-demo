import { beforeEach, describe, expect, it, vi } from 'vitest'

const { recordConversionEvent } = vi.hoisted(() => ({
  recordConversionEvent: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ LANDING_ALLOWED_ORIGINS: 'https://landing.example' }),
}))

vi.mock('@/lib/integrations/conversion-events', () => ({
  PublicTrackEventInput: {
    safeParse: (value: unknown) =>
      value &&
      typeof value === 'object' &&
      'event_name' in value &&
      value.event_name === 'page_view'
        ? { success: true, data: value }
        : { success: false },
  },
  clientIp: (request: Request) => request.headers.get('x-forwarded-for') ?? 'unknown',
  isLikelyBot: (userAgent: string | null) => !userAgent || /bot/i.test(userAgent),
  recordConversionEvent,
}))

vi.mock('@/lib/ratelimit', () => ({
  distributedRateLimit: async () => ({ success: true }),
}))

import { OPTIONS, POST } from './route'

function request(body: string, headers: Record<string, string> = {}) {
  const requestHeaders = {
    origin: 'https://landing.example',
    'user-agent': 'Mozilla/5.0',
    'x-forwarded-for': '203.0.113.10',
    ...headers,
  }
  return {
    headers: new Headers(requestHeaders),
    text: async () => body,
  } as never
}

function requestWithUserAgent(body: string, userAgent: string) {
  return request(body, { 'user-agent': userAgent })
}

describe('POST /api/public/track-event', () => {
  beforeEach(() => {
    recordConversionEvent.mockReset()
  })

  it('records an allowed intermediate event and always returns 204', async () => {
    const response = await POST(
      request(JSON.stringify({ event_name: 'page_view', visitor_id: 'visitor-1' })),
    )

    expect(response.status).toBe(204)
    expect(recordConversionEvent).toHaveBeenCalledOnce()
    expect(recordConversionEvent).toHaveBeenCalledWith(
      { event_name: 'page_view', visitor_id: 'visitor-1' },
      { ip: '203.0.113.10', userAgent: 'Mozilla/5.0' },
    )
  })

  it('silently ignores bots, disallowed origins, invalid JSON, and forbidden events', async () => {
    const cases = [
      requestWithUserAgent(JSON.stringify({ event_name: 'page_view' }), 'bot'),
      request(JSON.stringify({ event_name: 'page_view' }), { origin: 'https://evil.example' }),
      request('not-json'),
      request(JSON.stringify({ event_name: 'lead_created' })),
    ]

    for (const item of cases) {
      recordConversionEvent.mockReset()
      expect((await POST(item)).status).toBe(204)
      expect(recordConversionEvent).not.toHaveBeenCalled()
    }
  })

  it('answers CORS preflight without recording an event', () => {
    const response = OPTIONS({
      headers: new Headers({ origin: 'https://landing.example' }),
    } as never)

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://landing.example')
    expect(recordConversionEvent).not.toHaveBeenCalled()
  })
})
