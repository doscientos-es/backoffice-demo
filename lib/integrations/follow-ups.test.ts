import { describe, expect, it, vi } from 'vitest'

import { createAdminClient } from '@/lib/supabase/admin'

import { getFollowUps } from './follow-ups'

// Mock admin client
const mockChain: any = {
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  in: vi.fn(() => mockChain),
  gte: vi.fn(() => mockChain),
  lt: vi.fn(() => mockChain),
  is: vi.fn(() => mockChain),
  not: vi.fn(() => mockChain),
  order: vi.fn(() => mockChain),
  limit: vi.fn(() => Promise.resolve({ data: [] })),
}

const mockSupabase = {
  from: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase/admin', () => {
  return {
    createAdminClient: vi.fn(() => mockSupabase),
  }
})

// Mock env
vi.mock('@/lib/env', () => ({
  publicEnv: {
    NEXT_PUBLIC_APP_URL: 'https://app.test',
  },
  serverEnv: () => ({}),
}))

describe('getFollowUps logic', () => {
  it('returns an empty response when no data exists', async () => {
    const res = await getFollowUps()
    expect(res.counts.staleLeads).toBe(0)
    expect(res.counts.pendingProposals).toBe(0)
  })

  it('correctly maps a stale lead row', async () => {
    const mockSupabase = createAdminClient() as any

    const now = new Date('2026-06-29T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const staleDate = new Date(now - 48 * 3600_000).toISOString() // 48h ago

    const leadChain: any = {
      select: vi.fn(() => leadChain),
      in: vi.fn(() => leadChain),
      lt: vi.fn(() => leadChain),
      is: vi.fn(() => leadChain),
      order: vi.fn(() => leadChain),
      limit: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: 'lead-1',
              name: 'John Doe',
              company: 'Doe Inc',
              status: 'new',
              updated_at: staleDate,
            },
          ],
        }),
      ),
    }

    const propChain: any = {
      select: vi.fn(() => propChain),
      in: vi.fn(() => propChain),
      is: vi.fn(() => propChain),
      not: vi.fn(() => propChain),
      lt: vi.fn(() => propChain),
      order: vi.fn(() => propChain),
      limit: vi.fn(() => Promise.resolve({ data: [] })),
    }

    mockSupabase.from.mockReturnValueOnce(leadChain).mockReturnValueOnce(propChain)

    const res = await getFollowUps()
    expect(res.staleLeads).toHaveLength(1)
    const lead = res.staleLeads[0]!
    expect(lead.id).toBe('lead-1')
    expect(lead.hoursSince).toBe(48)
    expect(lead.url).toBe('https://app.test/leads/lead-1')
    expect(lead.statusLabel).toBe('Nuevo')

    vi.useRealTimers()
  })

  it('excludes leads that already have a future call or meeting', async () => {
    const mockSupabase = createAdminClient() as any
    const now = new Date('2026-06-29T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const staleDate = new Date(now - 48 * 3600_000).toISOString()
    const futureMeeting = new Date(now + 24 * 3600_000).toISOString()

    const chain = (data: unknown[]) => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        gte: vi.fn(() => query),
        lt: vi.fn(() => query),
        is: vi.fn(() => query),
        not: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => Promise.resolve({ data, error: null })),
      }
      return query
    }
    const lead = {
      id: 'lead-with-meeting',
      name: 'Lead con reunión',
      company: null,
      phone: null,
      email: null,
      source: null,
      status: 'new',
      assigned_to: 'member-1',
      updated_at: staleDate,
      created_at: staleDate,
    }
    mockSupabase.from
      .mockReturnValueOnce(chain([lead]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([lead]))
      .mockReturnValueOnce(
        chain([{ lead_id: lead.id, action_type: 'meeting', start_at: futureMeeting }]),
      )

    const res = await getFollowUps()
    expect(res.staleLeads).toEqual([])
    expect(res.uncontactedLeads).toEqual([])
    vi.useRealTimers()
  })

  it('correctly maps a pending proposal row', async () => {
    const mockSupabase = createAdminClient() as any

    const now = new Date('2026-06-29T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const sentDate = new Date(now - 100 * 3600_000).toISOString() // 100h ago

    const leadChain: any = {
      select: vi.fn(() => leadChain),
      in: vi.fn(() => leadChain),
      lt: vi.fn(() => leadChain),
      is: vi.fn(() => leadChain),
      order: vi.fn(() => leadChain),
      limit: vi.fn(() => Promise.resolve({ data: [] })),
    }

    const propChain: any = {
      select: vi.fn(() => propChain),
      in: vi.fn(() => propChain),
      is: vi.fn(() => propChain),
      not: vi.fn(() => propChain),
      lt: vi.fn(() => propChain),
      order: vi.fn(() => propChain),
      limit: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: 'prop-1',
              number: 'P-2026-01',
              title: 'Project X',
              status: 'sent',
              sent_at: sentDate,
              clients: { name: 'Acme Corp' },
              leads: null,
            },
          ],
        }),
      ),
    }

    mockSupabase.from.mockReturnValueOnce(leadChain).mockReturnValueOnce(propChain)

    const res = await getFollowUps()
    expect(res.pendingProposals).toHaveLength(1)
    const prop = res.pendingProposals[0]!
    expect(prop.id).toBe('prop-1')
    expect(prop.hoursSince).toBe(100)
    expect(prop.recipient).toBe('Acme Corp')
    expect(prop.url).toBe('https://app.test/proposals/prop-1')

    vi.useRealTimers()
  })
})
