import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({ state: { aiEnabled: true } }))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-model' },
  isAIEnabled: () => state.aiEnabled,
  runAIObject: vi.fn(async () => ({
    summary: 'Se acordó revisar el alcance antes de la siguiente reunión.',
    decisions: ['Revisar el alcance'],
    open_questions: ['Confirmar interlocutores'],
    tasks: [
      {
        title: 'Enviar resumen',
        description: 'Recoger el acuerdo de la llamada.',
        priority: 'high',
      },
    ],
    follow_up_focus: 'El acuerdo de alcance',
  })),
}))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
}))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/leads/queries', () => ({
  getLeadDetail: vi.fn(async () => ({
    lead: { name: 'Ana', status: 'qualifying' },
    linkedClientName: null,
    interactions: [
      {
        type: 'call',
        subject: 'Descubrimiento',
        body: null,
        payload: { transcript: 'Necesitamos un portal.' },
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

describe('POST /api/crm/ai/call-copilot', () => {
  beforeEach(() => {
    state.aiEnabled = true
  })

  it('does not call AI when the integration is disabled', async () => {
    state.aiEnabled = false
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )
    expect(response.status).toBe(503)
  })

  it('returns reviewable agreements, questions and task suggestions', async () => {
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      decisions: ['Revisar el alcance'],
      tasks: [{ title: 'Enviar resumen', priority: 'high' }],
    })
  })
})
