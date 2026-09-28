import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    leadSelect: '',
    leadOr: '',
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })),
}))
vi.mock('@/lib/schemas/vault', () => ({
  VAULT_SERVICE_LABELS: {},
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => {
      const chain = {
        select: vi.fn(),
        is: vi.fn(),
        or: vi.fn(),
        ilike: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
      }
      chain.select.mockImplementation((columns: string) => {
        if (table === 'leads') state.leadSelect = columns
        return chain
      })
      chain.is.mockImplementation(() => chain)
      chain.or.mockImplementation((filter: string) => {
        if (table === 'leads') state.leadOr = filter
        return chain
      })
      chain.ilike.mockImplementation(() => chain)
      chain.order.mockImplementation(() => chain)
      chain.limit.mockImplementation(async () => ({
        data:
          table === 'leads'
            ? [
                {
                  id: 'lead-1',
                  name: 'Juan García',
                  alias: 'Spinola',
                  company: 'Piscinas S.L.',
                  email: null,
                },
              ]
            : [],
        error: null,
      }))
      return chain
    },
  })),
}))

import { GET } from './route'

describe('GET /api/search', () => {
  it('searches leads by alias and uses it as the displayed name', async () => {
    const response = await GET(new NextRequest('http://localhost/api/search?q=Spinola'))
    const body = await response.json()

    expect(state.leadSelect).toBe('id, name, alias, company, email')
    expect(state.leadOr).toBe(
      'name.ilike.%Spinola%,alias.ilike.%Spinola%,company.ilike.%Spinola%,email.ilike.%Spinola%',
    )
    expect(body.items).toEqual([
      {
        id: 'lead-lead-1',
        type: 'lead',
        label: 'Spinola',
        sublabel: 'Juan García · Piscinas S.L.',
        href: '/leads/lead-1',
      },
    ])
  })
})
