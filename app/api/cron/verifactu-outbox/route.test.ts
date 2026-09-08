import { beforeEach, describe, expect, it, vi } from 'vitest'

const { retryDueVerifactuOutbox, serverEnv } = vi.hoisted(() => ({
  retryDueVerifactuOutbox: vi.fn(),
  serverEnv: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ serverEnv }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('@/lib/verifactu/outbox', () => ({ retryDueVerifactuOutbox }))

import { GET } from './route'

function request(token?: string): Request {
  return new Request('https://backoffice.test/api/cron/verifactu-outbox', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('GET /api/cron/verifactu-outbox', () => {
  beforeEach(() => {
    serverEnv.mockReturnValue({ CRON_SECRET: 'cron-secret' })
    retryDueVerifactuOutbox.mockResolvedValue([])
  })

  it('rejects calls without the cron secret', async () => {
    const response = await GET(request() as never)
    expect(response.status).toBe(401)
    expect(retryDueVerifactuOutbox).not.toHaveBeenCalled()
  })

  it('fails closed when the cron secret is not configured', async () => {
    serverEnv.mockReturnValue({ CRON_SECRET: '' })
    const response = await GET(request('anything') as never)
    expect(response.status).toBe(401)
    expect(retryDueVerifactuOutbox).not.toHaveBeenCalled()
  })

  it('reports the delivery summary', async () => {
    retryDueVerifactuOutbox.mockResolvedValue([
      { processed: true, status: 'accepted', csv: 'CSV-1' },
      { processed: true, status: 'error', csv: null },
      { processed: false, status: 'skipped', csv: null },
    ])

    const response = await GET(request('cron-secret') as never)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      total: 3,
      accepted: 1,
      rejected: 0,
      error: 1,
      skipped: 1,
      deferred: 0,
    })
    expect(retryDueVerifactuOutbox).toHaveBeenCalledWith(10)
  })

  it('returns 500 when the processor fails before completing a batch', async () => {
    retryDueVerifactuOutbox.mockRejectedValue(new Error('database unavailable'))
    const response = await GET(request('cron-secret') as never)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'verifactu_outbox_failed' })
  })
})
