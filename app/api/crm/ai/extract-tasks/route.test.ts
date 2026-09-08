import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const { runAIObject } = vi.hoisted(() => ({ runAIObject: vi.fn(async () => ({ tasks: [] })) }))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-model' },
  isAIEnabled: () => true,
  runAIObject,
}))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
}))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/leads/queries', () => ({
  getLeadDetail: vi.fn(async () => ({
    lead: { name: 'Ana', status: 'qualifying', notes: null },
    linkedClientName: null,
    interactions: [
      {
        type: 'call',
        subject: null,
        body: null,
        payload: { transcript: 'No acordamos un siguiente paso.' },
        created_at: '2026-08-01T10:00:00.000Z',
      },
    ],
    proposals: [],
    projects: [],
    invoices: [],
    tasks: [],
    reminders: [],
    attachments: [],
  })),
}))

import { POST } from './route'

describe('POST /api/crm/ai/extract-tasks', () => {
  it('allows an empty result instead of forcing invented tasks', async () => {
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, tasks: [] })
  })
})
