import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

const { createProposalDraftInvoices, sendProposalAcceptedEmail } = vi.hoisted(() => ({
  createProposalDraftInvoices: vi.fn(async () => ({ ids: [], created: 0 })),
  sendProposalAcceptedEmail: vi.fn(async () => undefined),
}))

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/invoices/proposal-drafts', () => ({ createProposalDraftInvoices }))
vi.mock('@/lib/integrations/send-proposal-accepted-email', () => ({ sendProposalAcceptedEmail }))

type ProposalRow = {
  id: string
  status: string
  maintenance_options?: unknown
  lead_id?: string | null
  client_id?: string | null
  clients?: {
    name: string | null
    nif: string | null
    billing_address_street: string | null
  } | null
} | null
type FetchResult = { data: ProposalRow; error: unknown }
type UpdateResult = { error: unknown }

const state: {
  fetchResult: FetchResult
  updateResult: UpdateResult
  lastPatch: Record<string, unknown> | null
  lastUpdateId: string | null
} = {
  fetchResult: { data: null, error: null },
  updateResult: { error: null },
  lastPatch: null,
  lastUpdateId: null,
}

// Mock builder keyed on the primary lookup: only the query that filters by
// `portal_token` resolves to `state.fetchResult`. Every secondary lookup used
// by the side-effect helpers (ensureProjectForProposal, promoteLeadFromClient,
// ensureClientForProposal) filters by other columns and resolves to empty, so
// they short-circuit without polluting the assertions.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (_table: string) => {
      const empty = { data: null, error: null }
      let isPrimary = false
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string) => {
          if (col === 'portal_token') isPrimary = true
          return chain
        },
        is: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => (isPrimary ? state.fetchResult : empty),
        single: async () => empty,
        insert: () => chain,
        update: (patch: Record<string, unknown>) => {
          state.lastPatch = patch
          return {
            eq: async (_col: string, id: string) => {
              state.lastUpdateId = id
              return state.updateResult
            },
          }
        },
      }
      return chain
    },
  }),
}))

const VALID_TOKEN = 'a'.repeat(48)

// A client row with the minimum fiscal data so `acceptWithFiscal` skips the
// fiscal-form requirement and exercises the plain accept → update path.
const COMPLETE_CLIENT = {
  name: 'Acme SL',
  nif: 'B12345678',
  billing_address_street: 'Calle Mayor 1, Madrid',
}

let acceptProposal: typeof import('./actions').acceptProposal
let rejectProposal: typeof import('./actions').rejectProposal
let selectProposalMaintenance: typeof import('./actions').selectProposalMaintenance
let sendProposalQuestion: typeof import('./actions').sendProposalQuestion

beforeAll(async () => {
  const actions = await import('./actions')
  acceptProposal = actions.acceptProposal
  rejectProposal = actions.rejectProposal
  selectProposalMaintenance = actions.selectProposalMaintenance
  sendProposalQuestion = actions.sendProposalQuestion
}, 30_000)

describe('portal proposal actions', () => {
  beforeEach(() => {
    state.fetchResult = { data: null, error: null }
    state.updateResult = { error: null }
    state.lastPatch = null
    state.lastUpdateId = null
    createProposalDraftInvoices.mockClear()
    sendProposalAcceptedEmail.mockClear()
    revalidatePath.mockClear()
  })

  it('rejects malformed tokens without touching the DB', async () => {
    const result = await acceptProposal('short')
    expect(result).toEqual({ ok: false, error: 'Token inválido' })
    expect(state.lastPatch).toBeNull()

    await expect(sendProposalQuestion('short', '¿Incluye soporte?')).resolves.toEqual({
      ok: false,
      error: 'La consulta no es válida',
    })
  })

  it('returns not-found when the proposal does not exist', async () => {
    state.fetchResult = { data: null, error: null }

    const result = await acceptProposal(VALID_TOKEN)
    expect(result).toEqual({ ok: false, error: 'Propuesta no encontrada' })
  })

  it('blocks transitions from already-responded states', async () => {
    state.fetchResult = { data: { id: 'p1', status: 'accepted' }, error: null }
    expect(await acceptProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: 'Esta propuesta ya ha sido respondida',
    })

    state.fetchResult = { data: { id: 'p1', status: 'rejected' }, error: null }
    expect(await rejectProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: 'Esta propuesta ya ha sido respondida',
    })
  })

  it('blocks transitions from draft or expired', async () => {
    state.fetchResult = { data: { id: 'p1', status: 'draft' }, error: null }
    expect(await acceptProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: 'Propuesta no disponible',
    })

    state.fetchResult = { data: { id: 'p1', status: 'expired' }, error: null }
    expect(await acceptProposal(VALID_TOKEN)).toEqual({
      ok: false,
      error: 'Propuesta expirada',
    })
  })

  it('accepts a sent proposal and revalidates the portal path', async () => {
    state.fetchResult = {
      data: { id: 'p1', status: 'sent', lead_id: null, client_id: 'c1', clients: COMPLETE_CLIENT },
      error: null,
    }

    const result = await acceptProposal(VALID_TOKEN)
    expect(result).toEqual({ ok: true })
    expect(state.lastUpdateId).toBe('p1')
    expect(state.lastPatch?.status).toBe('accepted')
    expect(typeof state.lastPatch?.responded_at).toBe('string')
    expect(createProposalDraftInvoices).toHaveBeenCalledWith(expect.anything(), 'p1', null)
    expect(revalidatePath).toHaveBeenCalledWith(`/p/proposal/${VALID_TOKEN}`)
  })

  it('rejects a viewed proposal and stores the rejection reason', async () => {
    state.fetchResult = { data: { id: 'p2', status: 'viewed' }, error: null }

    const result = await rejectProposal(VALID_TOKEN, 'No es lo que buscamos')
    expect(result).toEqual({ ok: true })
    expect(state.lastPatch?.status).toBe('rejected')
    expect(state.lastPatch?.signature_data).toEqual({
      rejection_reason: 'No es lo que buscamos',
    })
  })

  it('omits signature_data when no rejection reason is provided', async () => {
    state.fetchResult = { data: { id: 'p3', status: 'sent' }, error: null }

    await rejectProposal(VALID_TOKEN)
    expect(state.lastPatch?.signature_data).toBeUndefined()
  })

  it('surfaces DB update errors', async () => {
    state.fetchResult = {
      data: { id: 'p4', status: 'sent', lead_id: null, client_id: 'c1', clients: COMPLETE_CLIENT },
      error: null,
    }
    state.updateResult = { error: { message: 'db down' } }

    const result = await acceptProposal(VALID_TOKEN)
    expect(result).toEqual({ ok: false, error: 'No se pudo actualizar la propuesta' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects maintenance selection when the offer is disabled', async () => {
    state.fetchResult = {
      data: {
        id: 'p5',
        status: 'sent',
        maintenance_options: { ...DEFAULT_MAINTENANCE_OFFER, enabled: false },
      },
      error: null,
    }

    await expect(selectProposalMaintenance(VALID_TOKEN, null)).resolves.toEqual({
      ok: false,
      error: 'El mantenimiento no está disponible en esta propuesta',
    })
    expect(state.lastPatch).toBeNull()
  })
})
