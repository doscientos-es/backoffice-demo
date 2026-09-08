import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createProposalDraftInvoices, crm, sendProposalAcceptedEmail, state } = vi.hoisted(() => ({
  createProposalDraftInvoices: vi.fn(async () => ({ ids: [], created: 0 })),
  crm: {
    ensureClientForProposal: vi.fn(),
    ensureProjectForProposal: vi.fn(),
    hasCompleteFiscalData: vi.fn(),
    promoteLeadFromClient: vi.fn(),
  },
  state: {
    rpcArgs: null as Record<string, unknown> | null,
    rpcResult: {
      data: [{ version: 2 }] as Array<{ version: number }> | null,
      error: null as null | { message: string },
    },
    inserts: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
    proposal: {
      id: '494d62cb-fd56-4650-b131-9e3a927a20ad',
      number: null as string | null,
      status: 'draft',
      title: 'Automatización comercial',
      version: 1,
      lead_id: 'f4e5d6c7-b8a9-4012-8012-123456789abc',
      client_id: null as string | null,
      clients: null as {
        name: string | null
        nif: string | null
        billing_address_street: string | null
      } | null,
    },
    leadStatus: 'in_conversation',
  },
  sendProposalAcceptedEmail: vi.fn(async () => undefined),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(async () => ({ id: 'member-1', email: 'member@example.test' })),
  requireUser: vi.fn(async () => ({ id: 'member-1' })),
}))

vi.mock('@/lib/crm/conversion', () => crm)
vi.mock('@/lib/invoices/proposal-drafts', () => ({ createProposalDraftInvoices }))
vi.mock('@/lib/integrations/send-proposal-accepted-email', () => ({ sendProposalAcceptedEmail }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        like: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (patch: Record<string, unknown>) => {
          state.updates.push({ table, ...patch })
          return builder
        },
        insert: (row: Record<string, unknown>) => {
          state.inserts.push({ table, ...row })
          return builder
        },
        maybeSingle: async () => {
          if (table === 'proposals') return { data: state.proposal, error: null }
          if (table === 'leads') return { data: { status: state.leadStatus }, error: null }
          return { data: null, error: null }
        },
        // biome-ignore lint/suspicious/noThenProperty: intentional Supabase builder mock
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: table === 'proposals' ? [] : null, error: null }).then(resolve),
      }
      return builder
    },
    rpc: async (_name: string, args: Record<string, unknown>) => {
      state.rpcArgs = args
      return state.rpcResult
    },
  })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/google/backup', () => ({ backupProposalToDrive: vi.fn() }))
vi.mock('@/lib/email/render', () => ({ renderEmail: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn() }))

import {
  markProposalAsAccepted,
  markProposalAsRejected,
  markProposalAsSent,
  updateProposal,
} from './actions'

const ID = '494d62cb-fd56-4650-b131-9e3a927a20ad'

describe('updateProposal', () => {
  beforeEach(() => {
    state.rpcArgs = null
    state.rpcResult = { data: [{ version: 2 }], error: null }
    state.inserts = []
    state.updates = []
    state.proposal = {
      id: ID,
      version: 1,
      number: null,
      status: 'draft',
      title: 'Automatización comercial',
      lead_id: 'f4e5d6c7-b8a9-4012-8012-123456789abc',
      client_id: null,
      clients: null,
    }
    state.leadStatus = 'in_conversation'
  })

  it('does not pass derived totals to the item-replacement RPC', async () => {
    const result = await updateProposal({
      id: ID,
      expected_version: 1,
      title: 'Propuesta',
      problems: [{ id: 'pair-1', title: 'Proceso manual', description: 'Mucho trabajo' }],
      solutions: [{ id: 'pair-1', title: 'Automatizar', description: 'Menos trabajo' }],
      scope_modules: [
        {
          id: 'scope-1',
          title: 'Portal',
          description: 'Área privada',
          included: ['Acceso'],
          excluded: [],
          notes: null,
        },
      ],
      deliverables: 'Portal publicado',
      acceptance_criteria: 'Acceso verificado',
      payment_schedule: 'half_half',
      payment_terms: '50 % al aceptar.',
      change_management_terms: 'Cambios presupuestados.',
      maintenance_options: {
        heading: 'Mantenimiento web',
        intro: 'Soporte técnico continuo.',
        plans: [
          {
            id: 'essential',
            name: 'Esencial',
            summary: 'Cobertura básica.',
            monthly_price: 80,
            vat_rate: 21,
            coverage: ['Backups'],
            exclusions: [],
          },
        ],
      },
      maintenance_selected_plan_id: 'essential',
      items: [
        {
          description: 'Implementación',
          quantity: 1,
          unit_price: 1000,
          vat_rate: 21,
          billing_cycle: 'none',
        },
      ],
    })

    expect(result).toEqual({ ok: true, version: 2 })
    expect(state.rpcArgs).toMatchObject({ p_proposal_id: ID, p_expected_version: 1 })
    expect(state.rpcArgs?.p_patch).toEqual({
      title: 'Propuesta',
      problems: [{ id: 'pair-1', title: 'Proceso manual', description: 'Mucho trabajo' }],
      solutions: [{ id: 'pair-1', title: 'Automatizar', description: 'Menos trabajo' }],
      scope_modules: [
        {
          id: 'scope-1',
          title: 'Portal',
          description: 'Área privada',
          included: ['Acceso'],
          excluded: [],
          notes: null,
        },
      ],
      deliverables: 'Portal publicado',
      acceptance_criteria: 'Acceso verificado',
      payment_schedule: 'half_half',
      payment_terms: '50 % al aceptar.',
      change_management_terms: 'Cambios presupuestados.',
      maintenance_options: {
        enabled: true,
        heading: 'Mantenimiento web',
        intro: 'Soporte técnico continuo.',
        plans: [
          {
            id: 'essential',
            name: 'Esencial',
            summary: 'Cobertura básica.',
            monthly_price: 80,
            vat_rate: 21,
            coverage: ['Backups'],
            exclusions: [],
          },
        ],
      },
      maintenance_selected_plan_id: 'essential',
      maintenance_selection_source: 'team',
      maintenance_selected_at: expect.any(String),
    })
  })

  it('returns a structured conflict without overwriting a newer proposal', async () => {
    state.rpcResult = { data: null, error: { message: 'VERSION_CONFLICT' } }

    const result = await updateProposal({
      id: ID,
      expected_version: 1,
      title: 'Título local',
      items: [
        {
          description: 'Servicio',
          quantity: 1,
          unit_price: 100,
          vat_rate: 21,
          billing_cycle: 'none',
        },
      ],
    })

    expect(result).toMatchObject({ ok: false, code: 'conflict' })
  })

  it('returns each invalid field with an actionable label', async () => {
    const result = await updateProposal({
      id: ID,
      expected_version: 1,
      items: [
        { description: '', quantity: 0, unit_price: 100, vat_rate: 21, billing_cycle: 'none' },
      ],
      scope_modules: [
        { id: 'scope-1', title: '', description: null, included: [], excluded: [], notes: null },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error:
        'Módulo 1 · Nombre: El nombre del módulo es obligatorio\nLínea 1 · Descripción: Descripción obligatoria\nLínea 1 · Cantidad: Cantidad > 0',
    })
  })
})

describe('markProposalAsSent', () => {
  it('syncs a lead-first proposal and queues its 72-hour follow-up', async () => {
    const result = await markProposalAsSent({ id: ID })

    expect(result).toEqual({ ok: true })
    expect(state.updates).toContainEqual(
      expect.objectContaining({ table: 'proposals', status: 'sent' }),
    )
    expect(state.updates).toContainEqual(
      expect.objectContaining({ table: 'leads', status: 'quoted' }),
    )
    expect(state.inserts).toContainEqual(
      expect.objectContaining({
        table: 'tasks',
        kind: 'reminder',
        lead_id: state.proposal.lead_id,
        priority: 'high',
      }),
    )
    expect(state.inserts).toContainEqual(
      expect.objectContaining({
        table: 'lead_interactions',
        type: 'status_change',
        payload: expect.objectContaining({ to: 'quoted', proposal_id: ID }),
      }),
    )
  })
})

describe('markProposalAsAccepted', () => {
  beforeEach(() => {
    state.inserts = []
    state.updates = []
    createProposalDraftInvoices.mockClear()
    sendProposalAcceptedEmail.mockClear()
    state.proposal = {
      id: ID,
      number: null,
      status: 'sent',
      title: 'Automatización comercial',
      version: 1,
      lead_id: 'f4e5d6c7-b8a9-4012-8012-123456789abc',
      client_id: null,
      clients: null,
    }
    crm.hasCompleteFiscalData.mockReturnValue(false)
    crm.ensureClientForProposal.mockResolvedValue({ clientId: 'client-1', created: true })
    crm.ensureProjectForProposal.mockResolvedValue({ projectId: 'project-1', created: true })
    crm.promoteLeadFromClient.mockResolvedValue({ leadId: null, promoted: false })
  })

  it('creates and links the fiscal client before accepting a lead-first proposal', async () => {
    const fiscal = {
      name: 'Godoy Abogados Patrimoniales',
      nif: 'B12345678',
      billing_address: 'Calle Mayor 1',
      contact_person: 'Ana Godoy',
      email: 'ana@example.test',
      phone: '600000000',
    }

    const result = await markProposalAsAccepted({ id: ID, fiscal })

    expect(result).toEqual({ ok: true })
    expect(crm.ensureClientForProposal).toHaveBeenCalledWith(expect.anything(), ID, fiscal)
    expect(state.updates).toContainEqual(
      expect.objectContaining({
        table: 'proposals',
        status: 'accepted',
        accepted_fiscal_data: fiscal,
      }),
    )
    expect(createProposalDraftInvoices).toHaveBeenCalledWith(expect.anything(), ID, 'member-1')
  })

  it('repairs an already accepted lead-first proposal when fiscal data is provided', async () => {
    state.proposal.status = 'accepted'
    const fiscal = {
      name: 'Godoy Abogados Patrimoniales',
      nif: 'B12345678',
      billing_address: 'Calle Mayor 1',
    }

    const result = await markProposalAsAccepted({ id: ID, fiscal })

    expect(result).toEqual({ ok: true })
    expect(crm.ensureClientForProposal).toHaveBeenCalledWith(expect.anything(), ID, fiscal)
    expect(state.updates).toContainEqual(
      expect.objectContaining({ table: 'proposals', accepted_fiscal_data: fiscal }),
    )
  })
})

describe('markProposalAsRejected', () => {
  beforeEach(() => {
    state.updates = []
    state.proposal = {
      id: ID,
      number: 'P-2026-001',
      status: 'viewed',
      title: 'Automatización comercial',
      version: 1,
      lead_id: 'f4e5d6c7-b8a9-4012-8012-123456789abc',
      client_id: null,
      clients: null,
    }
  })

  it('records an external client rejection and its response date', async () => {
    const result = await markProposalAsRejected({ id: ID })

    expect(result).toEqual({ ok: true })
    expect(state.updates).toContainEqual(
      expect.objectContaining({
        table: 'proposals',
        status: 'rejected',
        responded_at: expect.any(String),
      }),
    )
  })

  it('does not reject a proposal that has not been delivered', async () => {
    state.proposal.status = 'draft'

    const result = await markProposalAsRejected({ id: ID })

    expect(result).toEqual({
      ok: false,
      error: 'Solo se pueden rechazar propuestas enviadas, vistas o expiradas',
    })
    expect(state.updates).toEqual([])
  })
})
