import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: { aiEnabled: true, proposal: { title: 'Portal de clientes' } as { title: string } | null },
}))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { drafter: 'test-model' },
  isAIEnabled: () => state.aiEnabled,
  runAIObject: vi.fn(async () => ({
    overview: 'Primero alinearemos alcance y accesos.',
    phases: [
      {
        name: 'Descubrimiento',
        objective: 'Alinear el alcance aceptado.',
        tasks: [
          {
            title: 'Revisar alcance',
            description: 'Usar la propuesta aceptada.',
            priority: 'high',
          },
        ],
      },
    ],
    checklist: ['Confirmar interlocutores'],
    kickoff_agenda: ['Objetivos', 'Alcance', 'Siguientes pasos'],
  })),
}))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
}))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data:
            table === 'projects'
              ? { id: 'project-1', name: 'Portal', description: null, notes: null }
              : state.proposal,
        }),
      }
      return chain
    },
  })),
}))

import { POST } from './route'

describe('POST /api/projects/[id]/generate-kickoff', () => {
  beforeEach(() => {
    state.aiEnabled = true
    state.proposal = { title: 'Portal de clientes' }
  })

  it('does not generate a plan when AI is disabled', async () => {
    state.aiEnabled = false
    const response = await POST(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'project-1' }),
    })
    expect(response.status).toBe(503)
  })

  it('requires an accepted proposal linked to the project', async () => {
    state.proposal = null
    const response = await POST(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'project-1' }),
    })
    expect(response.status).toBe(422)
  })

  it('returns a reviewable phases, tasks, checklist and kickoff agenda', async () => {
    const response = await POST(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'project-1' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      phases: [{ name: 'Descubrimiento', tasks: [{ title: 'Revisar alcance' }] }],
      checklist: ['Confirmar interlocutores'],
    })
  })
})
