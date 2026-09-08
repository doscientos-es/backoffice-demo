import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  isTeam: false,
  unlocked: true,
  proposal: null as Record<string, unknown> | null,
  items: [] as Array<Record<string, unknown>>,
}))
const renderProposalPdf = vi.hoisted(() => vi.fn(async () => Buffer.from('pdf-content')))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () =>
    state.isTeam ? { ok: true, user: { id: 'member-1' } } : { ok: false },
}))
vi.mock('@/lib/portal/access', () => ({ isPortalUnlocked: async () => state.unlocked }))
vi.mock('@/lib/proposals/proposal-pdf-document', () => ({
  proposalPdfFilename: (number: string | null, id: string) => `propuesta-${number ?? id}.pdf`,
  renderProposalPdf,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => ({ data: state.proposal, error: null }),
        order: async () => ({ data: state.items, error: null }),
      }
      return table === 'proposals' ? chain : chain
    },
  }),
}))

const TOKEN = 'a'.repeat(48)
const context = { params: Promise.resolve({ token: TOKEN }) }

function request() {
  return new NextRequest(`https://app.example.test/p/proposal/${TOKEN}/pdf`)
}

describe('GET /p/proposal/[token]/pdf', () => {
  beforeEach(() => {
    state.isTeam = false
    state.unlocked = true
    state.items = []
    renderProposalPdf.mockClear()
    state.proposal = {
      id: 'proposal-1',
      status: 'sent',
      title: 'Automatización comercial',
      number: 'P-001',
      subtotal: 1000,
      tax_amount: 210,
      total: 1210,
      clients: { name: 'Acme SL' },
      leads: null,
    }
  })

  it('keeps draft PDFs private to team members', async () => {
    const { GET } = await import('./route')
    state.proposal = { ...state.proposal, status: 'draft' }

    const response = await GET(request(), context)

    expect(response.status).toBe(404)
  })

  it('redirects a password-locked client to the proposal portal', async () => {
    const { GET } = await import('./route')
    state.unlocked = false

    const response = await GET(request(), context)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(`https://app.example.test/p/proposal/${TOKEN}`)
  })

  it('returns the attachment to a team member previewing a draft', async () => {
    const { GET } = await import('./route')
    state.isTeam = true
    state.proposal = { ...state.proposal, status: 'draft' }
    state.items = [
      {
        id: 'item-1',
        description: 'Implementación',
        quantity: 1,
        unit_price: 1000,
        vat_rate: 21,
        subtotal: 1000,
        billing_cycle: 'none',
      },
    ]

    const response = await GET(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('propuesta-P-001.pdf')
    expect(renderProposalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        maintenanceOffer: expect.objectContaining({ plans: expect.any(Array) }),
        maintenanceSelectedPlanId: null,
      }),
    )
  })
})
