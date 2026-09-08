import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    aiEnabled: true,
    leadId: 'lead-1',
    generatedPrompt: '',
    generatedSystem: '',
  },
}))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { drafter: 'test-model' },
  isAIEnabled: () => state.aiEnabled,
  runAIObject: vi.fn(async (input: { user: string; system: string }) => {
    state.generatedPrompt = input.user
    state.generatedSystem = input.system
    return {
      title: 'Propuesta de portal de clientes',
      context_markdown: 'El equipo necesita centralizar su operativa.',
      notes: '',
      terms: '',
      scope_modules: [
        {
          title: 'Portal de clientes',
          description: 'Unifica el acceso de los clientes.',
          included: ['Acceso privado'],
          excluded: ['Integraciones no analizadas'],
          notes: 'Validar los flujos prioritarios.',
        },
      ],
      deliverables: '- Portal publicado',
      acceptance_criteria: '- El cliente valida el acceso',
      payment_schedule: 'half_half',
      payment_terms: '50 % al aceptar y 50 % a la entrega.',
      change_management_terms: 'Los cambios fuera de alcance se valoran antes de ejecutarse.',
      pairs: [
        {
          problem: 'Procesos dispersos',
          problemDescription: 'La información está repartida.',
          solution: 'Portal centralizado',
          solutionDescription: 'Un punto de acceso único.',
        },
      ],
    }
  }),
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
}))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/leads/queries', () => ({
  getLeadDetail: vi.fn(async () => ({
    lead: {
      name: 'Ana',
      company: 'Acme',
      status: 'qualifying',
      notes: 'Quiere reducir tareas manuales.',
    },
    linkedClientName: null,
    interactions: [
      {
        type: 'call',
        subject: 'Descubrimiento',
        body: null,
        payload: { transcript: 'El equipo necesita un portal para sus clientes.' },
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
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: async () => ({ data: { lead_id: state.leadId } }) }),
        }),
      }),
    }),
  })),
}))

import { POST } from './route'

describe('POST /api/proposals/[id]/generate-draft', () => {
  beforeEach(() => {
    state.aiEnabled = true
    state.leadId = 'lead-1'
    state.generatedPrompt = ''
    state.generatedSystem = ''
  })

  it('rejects requests when AI is disabled', async () => {
    state.aiEnabled = false
    expect(
      (await POST(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'p-1' }) }))
        .status,
    ).toBe(503)
  })

  it('requires a proposal linked to a lead', async () => {
    state.leadId = ''
    expect(
      (await POST(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'p-1' }) }))
        .status,
    ).toBe(422)
  })

  it('uses the lead briefing, including call transcripts, to prepare the draft', async () => {
    const response = await POST(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'p-1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      title: 'Propuesta de portal de clientes',
      pairs: [
        {
          problemDescription: 'La información está repartida.',
          solutionDescription: 'Un punto de acceso único.',
        },
      ],
      scope_modules: [
        expect.objectContaining({ title: 'Portal de clientes', id: expect.any(String) }),
      ],
      deliverables: '- Portal publicado',
      acceptance_criteria: '- El cliente valida el acceso',
      payment_schedule: 'half_half',
    })
    expect(state.generatedPrompt).toContain('Transcripción: El equipo necesita un portal')
    expect(state.generatedSystem).toContain('scope_modules')
    expect(state.generatedSystem).toContain('acceptance_criteria')
  })
})
