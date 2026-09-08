import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    cachedPdf: null as ArrayBuffer | null,
    uploaded: [] as Array<{ bucket: string; path: string; contentType?: string }>,
    renderCalls: 0,
  },
}))

vi.mock('@/lib/diagnostics/report', () => ({
  renderDiagnosticPdf: vi.fn(async () => {
    state.renderCalls += 1
    return Buffer.from([9, 8, 7])
  }),
}))

vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ LANDING_URL: 'https://doscientos.es' }),
}))

vi.mock('@/lib/integrations/conversion-events', () => ({ recordConversionEvent: vi.fn() }))

vi.mock('@/lib/storage', () => ({
  getStorage: () => ({
    download: async () => ({ data: state.cachedPdf, error: null }),
    upload: async (
      bucket: string,
      path: string,
      _data: ArrayBuffer,
      options?: { contentType?: string },
    ) => {
      state.uploaded.push({ bucket, path, contentType: options?.contentType })
      return { error: null }
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({
        data: {
          id: 'diagnostic-1',
          lead_id: 'lead-1',
          email: 'lead@example.test',
          company: 'Example',
          answers: { proceso: 'Seguimiento manual' },
          metrics: {
            yearlyHours: 100,
            yearlyCost: 2500,
            monthlyHours: 8,
            risk: 'Alta',
            primaryOpportunity: 'Automatizar el seguimiento',
          },
        },
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }
    return { from: () => chain }
  },
}))

import { NextRequest } from 'next/server'

import { GET } from './route'

function request(token = 'valid-token') {
  return new NextRequest(`http://localhost/api/public/diagnostics/diagnostic-1/pdf?token=${token}`)
}

describe('GET /api/public/diagnostics/[id]/pdf', () => {
  beforeEach(() => {
    state.cachedPdf = null
    state.uploaded = []
    state.renderCalls = 0
  })

  it('serves a cached report without rendering it again', async () => {
    state.cachedPdf = new Uint8Array([1, 2, 3]).buffer

    const response = await GET(request(), { params: Promise.resolve({ id: 'diagnostic-1' }) })

    expect(response.status).toBe(200)
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer)
    expect(state.renderCalls).toBe(0)
    expect(state.uploaded).toEqual([])
  })

  it('renders and stores the report once when the cache is empty', async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: 'diagnostic-1' }) })

    expect(response.status).toBe(200)
    expect(state.renderCalls).toBe(1)
    expect(state.uploaded).toEqual([
      {
        bucket: 'documents',
        path: 'diagnostics/diagnostic-1/diagnostico-doscientos.pdf',
        contentType: 'application/pdf',
      },
    ])
  })
})