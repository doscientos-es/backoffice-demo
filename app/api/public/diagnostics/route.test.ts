import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const scheduled: Array<() => Promise<void>> = []
  return {
    scheduled,
    after: vi.fn((callback: () => Promise<void>) => scheduled.push(callback)),
    insert: vi.fn(),
    update: vi.fn(),
    recordConversionEvent: vi.fn(),
    renderDiagnosticPdf: vi.fn(),
    renderEmail: vi.fn(),
    sendEmail: vi.fn(),
  }
})

vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after: mocks.after,
}))

vi.mock('@/lib/env', () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://app.example' },
  serverEnv: () => ({ LANDING_ALLOWED_ORIGINS: ' "https://landing.example/" ' }),
}))
vi.mock('@/lib/ratelimit', () => ({
  distributedRateLimit: async () => ({ success: true }),
}))
vi.mock('@/lib/integrations/conversion-events', () => ({
  recordConversionEvent: mocks.recordConversionEvent,
}))
vi.mock('@/lib/diagnostics/report', () => ({ renderDiagnosticPdf: mocks.renderDiagnosticPdf }))
vi.mock('@/lib/email/render', () => ({ renderEmail: mocks.renderEmail }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/components/email/diagnostic-report-email', () => ({
  DiagnosticReportEmail: () => null,
}))

const leadQuery = {
  select: () => ({
    ilike: () => ({
      is: () => ({
        order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      }),
    }),
  }),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'leads') return leadQuery
      return {
        insert: mocks.insert,
        update: mocks.update,
      }
    },
  }),
}))

import { NextRequest } from 'next/server'

import { OPTIONS, POST } from './route'

function request(origin = 'https://landing.example') {
  const request = new NextRequest('http://localhost/api/public/diagnostics', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({
      email: 'ana@example.com',
      answers: {
        proceso: 'Pasar pedidos de email a Excel',
        personas: 2,
        minutos_por_vez: 15,
        veces_por_semana: 5,
        coste_hora: 25,
        impacto: 'Retrasos y seguimiento manual',
      },
      metrics: {
        monthlyHours: 8,
        yearlyHours: 96,
        yearlyCost: 3200,
        risk: 'Inicial',
        primaryOpportunity: 'Automatizar pedidos',
      },
    }),
  })
  request.headers.set('origin', origin)
  return request
}

describe('POST /api/public/diagnostics', () => {
  beforeEach(() => {
    mocks.scheduled.length = 0
    vi.clearAllMocks()
    mocks.insert.mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: 'diagnostic-1' }, error: null }) }),
    })
    mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mocks.renderDiagnosticPdf.mockResolvedValue(Buffer.from('pdf'))
    mocks.renderEmail.mockResolvedValue('<p>email</p>')
    mocks.sendEmail.mockResolvedValue({ mocked: false })
  })

  it('stores the request and responds before sending the report', async () => {
    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.reportUrl).toMatch(
      /^https:\/\/landing\.example\/diagnostico\/informe\?id=diagnostic-1&token=/,
    )
    expect(body.pdfUrl).toMatch(
      /^https:\/\/app\.example\/api\/public\/diagnostics\/diagnostic-1\/pdf\?token=/,
    )
    expect(response.headers.get('access-control-allow-origin')).toBe('https://landing.example')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued' }))
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.sendEmail).not.toHaveBeenCalled()

    const scheduledWork = mocks.scheduled[0]
    expect(scheduledWork).toBeDefined()
    if (!scheduledWork) throw new Error('Expected diagnostic report work to be scheduled')
    await scheduledWork()
    expect(mocks.sendEmail).toHaveBeenCalledOnce()
    expect(mocks.renderDiagnosticPdf).toHaveBeenCalledWith(
      expect.objectContaining({ reportUrl: body.reportUrl }),
    )
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }))
  })

  it('returns the required CORS preflight headers', () => {
    const response = OPTIONS({
      headers: new Headers({ origin: 'https://landing.example' }),
    } as never)

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://landing.example')
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
  })

  it('accepts a local landing origin outside production', async () => {
    const response = await POST(request('http://localhost:4321'))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:4321')
    expect(body.reportUrl).toMatch(/^http:\/\/localhost:4321\/diagnostico\/informe\?id=/)
  })
})
