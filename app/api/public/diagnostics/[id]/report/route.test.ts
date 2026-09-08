import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after: mocks.after,
}))
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ LANDING_ALLOWED_ORIGINS: 'https://landing.example' }),
}))
vi.mock('@/lib/integrations/conversion-events', () => ({ recordConversionEvent: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))

import { NextRequest } from 'next/server'

import { GET } from './route'

describe('GET /api/public/diagnostics/[id]/report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      }),
    })
  })

  it('returns only the report data for a valid token', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: 'diagnostic-1',
        lead_id: 'lead-1',
        company: 'Fincas Soler',
        answers: { proceso: 'Asignar visitas', impacto: 'Retrasos' },
        metrics: { yearlyHours: 120, yearlyCost: 3000, risk: 'Media' },
      },
    })
    const request = new NextRequest(
      'https://app.example/api/public/diagnostics/diagnostic-1/report?token=valid-token',
      {
        headers: { origin: 'https://landing.example' },
      },
    )

    const response = await GET(request, { params: Promise.resolve({ id: 'diagnostic-1' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      company: 'Fincas Soler',
      answers: { proceso: 'Asignar visitas', impacto: 'Retrasos' },
      metrics: { yearlyHours: 120, yearlyCost: 3000, risk: 'Media' },
    })
  })

  it('rejects a missing token', async () => {
    const request = new NextRequest(
      'https://app.example/api/public/diagnostics/diagnostic-1/report',
    )
    const response = await GET(request, { params: Promise.resolve({ id: 'diagnostic-1' }) })

    expect(response.status).toBe(401)
  })
})
