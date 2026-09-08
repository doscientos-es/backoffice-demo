import { describe, expect, it } from 'vitest'

import { hasCompleteFiscalData, promoteLeadFromClient } from '@/lib/crm/conversion'

describe('hasCompleteFiscalData', () => {
  it('is true only when name, nif and billing address street are all present', () => {
    expect(
      hasCompleteFiscalData({ name: 'Acme', nif: 'B1', billing_address_street: 'Calle 1' }),
    ).toBe(true)
  })

  it('is false when any field is missing or blank', () => {
    expect(hasCompleteFiscalData({ name: null, nif: 'B1', billing_address_street: 'C' })).toBe(
      false,
    )
    expect(hasCompleteFiscalData({ name: 'Acme', nif: null, billing_address_street: 'C' })).toBe(
      false,
    )
    expect(hasCompleteFiscalData({ name: 'Acme', nif: 'B1', billing_address_street: null })).toBe(
      false,
    )
    expect(hasCompleteFiscalData({ name: '  ', nif: 'B1', billing_address_street: 'C' })).toBe(
      false,
    )
  })
})

type FakeOpts = {
  clientRow?: { lead_id: string | null } | null
  leadRow?: { status: string } | null
  updateErr?: unknown
}

// Minimal chainable Supabase double covering the queries promoteLeadFromClient
// issues: clients.select(lead_id), leads.select(status), leads.update, and the
// lead_interactions.insert side effect.
function makeClient(opts: FakeOpts) {
  const calls = { updates: [] as Record<string, unknown>[], inserts: [] as unknown[] }
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === 'clients') return { data: opts.clientRow ?? null, error: null }
          if (table === 'leads') return { data: opts.leadRow ?? null, error: null }
          return { data: null, error: null }
        },
        update: (patch: Record<string, unknown>) => {
          calls.updates.push(patch)
          return { eq: async () => ({ error: opts.updateErr ?? null }) }
        },
        insert: (row: unknown) => {
          calls.inserts.push(row)
          return { error: null }
        },
      }
      return builder
    },
  }
  return { client, calls }
}

type Client = Parameters<typeof promoteLeadFromClient>[0]

describe('promoteLeadFromClient', () => {
  it('returns not-promoted when the client has no linked lead', async () => {
    const { client } = makeClient({ clientRow: { lead_id: null } })
    expect(await promoteLeadFromClient(client as unknown as Client, 'c1')).toEqual({
      leadId: null,
      promoted: false,
    })
  })

  it('promotes an open lead to won and logs an interaction', async () => {
    const { client, calls } = makeClient({
      clientRow: { lead_id: 'l1' },
      leadRow: { status: 'qualifying' },
    })
    const res = await promoteLeadFromClient(client as unknown as Client, 'c1')
    expect(res).toEqual({ leadId: 'l1', promoted: true })
    expect(calls.updates[0]?.status).toBe('won')
    expect(calls.inserts).toHaveLength(1)
  })

  it('skips leads already in a terminal state', async () => {
    for (const status of ['won', 'lost']) {
      const { client, calls } = makeClient({
        clientRow: { lead_id: 'l1' },
        leadRow: { status },
      })
      const res = await promoteLeadFromClient(client as unknown as Client, 'c1')
      expect(res).toEqual({ leadId: 'l1', promoted: false })
      expect(calls.updates).toHaveLength(0)
    }
  })

  it('returns not-promoted (swallowing the error) when the update fails', async () => {
    const { client, calls } = makeClient({
      clientRow: { lead_id: 'l1' },
      leadRow: { status: 'new' },
      updateErr: { message: 'db down' },
    })
    const res = await promoteLeadFromClient(client as unknown as Client, 'c1')
    expect(res).toEqual({ leadId: 'l1', promoted: false })
    expect(calls.inserts).toHaveLength(0)
  })
})
