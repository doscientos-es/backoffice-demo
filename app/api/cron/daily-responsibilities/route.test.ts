import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendDailyResponsibilityNotifications, serverEnv } = vi.hoisted(() => ({
  sendDailyResponsibilityNotifications: vi.fn(),
  serverEnv: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ serverEnv }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('@/lib/notifications/daily-responsibilities', () => ({
  sendDailyResponsibilityNotifications,
}))

import { GET } from './route'

function request(token?: string): Request {
  return new Request('https://backoffice.test/api/cron/daily-responsibilities', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('GET /api/cron/daily-responsibilities', () => {
  beforeEach(() => {
    serverEnv.mockReturnValue({ CRON_SECRET: 'cron-secret' })
    sendDailyResponsibilityNotifications.mockResolvedValue({ scanned: 2, notified: 1, skipped: 1 })
  })

  it('rejects calls without the cron secret', async () => {
    const response = await GET(request() as never)
    expect(response.status).toBe(401)
    expect(sendDailyResponsibilityNotifications).not.toHaveBeenCalled()
  })

  it('runs the daily notification summary', async () => {
    const response = await GET(request('cron-secret') as never)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ scanned: 2, notified: 1, skipped: 1 })
  })
})
