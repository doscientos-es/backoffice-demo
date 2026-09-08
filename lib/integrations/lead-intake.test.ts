/**
 * lead-intake.test.ts
 *
 * Covers the ingestLead() pipeline with focus on cross-source deduplication
 * and the enrichLead() merge logic. No real DB or network required.
 *
 * Scenarios:
 *  - new lead → inserts row, returns duplicate: false
 *  - externalId idempotency → returns duplicate: true without insert
 *  - soft-dedupe by email → enriches existing lead, returns duplicate: true
 *  - soft-dedupe by phone → enriches existing lead, returns duplicate: true
 *  - enrichLead fills only empty fields, never overwrites existing values
 *  - enrichLead appends notes with separator, idempotent on retry
 *  - enrichLead skips update when nothing changed
 *  - validation failure → ok: false
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── shared state ──────────────────────────────────────────────────────────────

const { notifyNewLead, sendLeadConfirmation, store } = vi.hoisted(() => ({
  notifyNewLead: vi.fn().mockResolvedValue(undefined),
  sendLeadConfirmation: vi.fn().mockResolvedValue(undefined),
  store: {
    existingById: null as Record<string, unknown> | null,
    existingByEmail: null as Record<string, unknown> | null,
    existingByPhone: null as Record<string, unknown> | null,
    updatedRow: null as Record<string, unknown> | null,
    insertedRow: null as Record<string, unknown> | null,
    insertedRows: [] as Record<string, unknown>[],
    enrichSelectResult: null as Record<string, unknown> | null,
  },
}))

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => buildChain(table),
  }),
}))

vi.mock('@/lib/integrations/lead-pipeline', () => ({
  runLeadPipeline: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/integrations/notify-new-lead', () => ({
  notifyNewLead,
}))

vi.mock('@/lib/integrations/send-lead-confirmation', () => ({
  sendLeadConfirmation,
}))

vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

vi.mock('next/server', () => ({
  after: (fn: () => unknown) => fn(), // execute inline in tests
}))

/**
 * Builds a chainable Supabase query mock.
 * Tracks inserted/updated rows and returns mocked select results based on
 * whichever filter method was called (eq on external_id, email, or phone).
 */
function buildChain(table: string) {
  let op: 'select' | 'insert' | 'update' | 'none' = 'none'
  const filters: Record<string, unknown> = {}

  const chain: Record<string, unknown> = {
    select(_cols?: string) {
      // Don't overwrite a DML op already set (insert/update), so single()
      // can detect it correctly after .insert(row).select("id").single().
      if (op === 'none') op = 'select'
      return chain
    },
    insert(row: Record<string, unknown>) {
      op = 'insert'
      store.insertedRow = { table, ...row }
      store.insertedRows.push(store.insertedRow)
      return chain
    },
    update(patch: Record<string, unknown>) {
      op = 'update'
      store.updatedRow = { table, ...patch }
      return chain
    },
    eq(col: string, val: unknown) {
      filters[col] = val
      return chain
    },
    is(_col: string, _val: unknown) {
      return chain
    },
    gte(_col: string, _val: unknown) {
      return chain
    },
    in(_col: string, _values: unknown[]) {
      return chain
    },
    limit(_n: number) {
      return chain
    },
    async single() {
      if (op === 'insert') return { data: { id: 'new-lead-uuid' }, error: null }
      return { data: null, error: null }
    },
    async maybeSingle() {
      if (op === 'insert') return { data: { id: 'new-lead-uuid' }, error: null }

      // externalId idempotency lookup
      if (filters.external_id) {
        return { data: store.existingById, error: null }
      }
      // enrichLead inner select (by id)
      if (filters.id) {
        return { data: store.enrichSelectResult, error: null }
      }
      // soft-dedupe by email
      if (filters.email) {
        return { data: store.existingByEmail, error: null }
      }
      // soft-dedupe by phone
      if (filters.phone) {
        return { data: store.existingByPhone, error: null }
      }
      return { data: null, error: null }
    },
  }
  return chain
}

// ── SUT ───────────────────────────────────────────────────────────────────────

import { ingestLead } from '@/lib/integrations/lead-intake'

// ── fixtures ──────────────────────────────────────────────────────────────────

const landingIntake = {
  name: 'María López',
  email: 'maria@example.com',
  phone: '+34600111222',
  source: 'landing',
} as const

const calIntake = {
  name: 'Guest',
  email: 'maria@example.com',
  company: 'Acme SL',
  notes: 'Meeting confirmed for Tuesday',
  source: 'cal',
  externalId: 'booking-uid-abc',
  externalSource: 'cal',
} as const

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  notifyNewLead.mockClear()
  sendLeadConfirmation.mockClear()
  store.existingById = null
  store.existingByEmail = null
  store.existingByPhone = null
  store.updatedRow = null
  store.insertedRow = null
  store.insertedRows = []
  store.enrichSelectResult = null
})

// ── 1. Happy path ─────────────────────────────────────────────────────────────

describe('ingestLead – new lead', () => {
  it('inserts a row and returns duplicate: false', async () => {
    const result = await ingestLead(landingIntake)
    expect(result).toEqual({ ok: true, leadId: 'new-lead-uuid', duplicate: false })
    expect(store.insertedRows.find((row) => row.table === 'leads')).toMatchObject({
      name: 'María López',
      email: 'maria@example.com',
    })
    await vi.waitFor(() =>
      expect(store.insertedRows.find((row) => row.table === 'lead_interactions')).toMatchObject({
        lead_id: 'new-lead-uuid',
        type: 'note',
        subject: 'Lead recibido desde Landing',
      }),
    )
    expect(store.insertedRows.find((row) => row.table === 'conversion_events')).toMatchObject({
      lead_id: 'new-lead-uuid',
      event_name: 'lead_created',
    })
    await vi.waitFor(() =>
      expect(sendLeadConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: 'new-lead-uuid',
          leadEmail: 'maria@example.com',
          leadSource: 'Landing',
        }),
      ),
    )
    await vi.waitFor(() => expect(notifyNewLead).toHaveBeenCalledOnce())
    expect(sendLeadConfirmation.mock.invocationCallOrder[0]).toBeLessThan(
      notifyNewLead.mock.invocationCallOrder[0] as number,
    )
  })

  it('returns ok:false when validation fails', async () => {
    const result = await ingestLead({ name: '', source: 'landing' } as never)
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toMatch(/name/i)
  })
})

// ── 2. ExternalId idempotency (step 2) ────────────────────────────────────────

describe('ingestLead – externalId dedupe', () => {
  it('returns duplicate: true without inserting when externalId already exists', async () => {
    store.existingById = { id: 'existing-lead-uuid' }
    const result = await ingestLead(calIntake)
    expect(result).toEqual({ ok: true, leadId: 'existing-lead-uuid', duplicate: true })
    expect(store.insertedRow).toBeNull()
  })
})

// ── 3. Soft-dedupe + enrich (step 3) ──────────────────────────────────────────

describe('ingestLead – soft-dedupe by email (cross-source)', () => {
  it('returns duplicate: true and does not insert a second lead', async () => {
    store.existingByEmail = { id: 'lead-from-landing' }
    store.enrichSelectResult = {
      email: 'maria@example.com',
      phone: null,
      company: null,
      notes: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      ip: null,
      device: null,
      browser: null,
      language: null,
    }

    const result = await ingestLead(calIntake)
    expect(result).toEqual({ ok: true, leadId: 'lead-from-landing', duplicate: true })
    expect(store.insertedRow).toBeNull()
  })

  it('enriches the existing lead with company from the second source', async () => {
    store.existingByEmail = { id: 'lead-from-landing' }
    store.enrichSelectResult = {
      email: 'maria@example.com',
      phone: '+34600111222',
      company: null,
      notes: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      ip: null,
      device: null,
      browser: null,
      language: null,
    }

    await ingestLead(calIntake)
    expect(store.updatedRow).toMatchObject({ company: 'Acme SL' })
  })

  it('does not overwrite existing company with incoming value', async () => {
    store.existingByEmail = { id: 'lead-from-landing' }
    store.enrichSelectResult = {
      email: 'maria@example.com',
      phone: null,
      company: 'Original SL',
      notes: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      ip: null,
      device: null,
      browser: null,
      language: null,
    }

    await ingestLead(calIntake)
    // company should NOT appear in the update because it already has a value
    expect(store.updatedRow?.company).toBeUndefined()
  })
})

describe('ingestLead – soft-dedupe by phone', () => {
  it('matches by phone when email is absent and enriches', async () => {
    store.existingByPhone = { id: 'lead-by-phone' }
    store.enrichSelectResult = {
      email: null,
      phone: '+34600111222',
      company: null,
      notes: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      ip: null,
      device: null,
      browser: null,
      language: null,
    }

    const noEmailIntake = {
      name: 'Guest',
      phone: '+34600111222',
      source: 'cal',
      externalId: 'uid-2',
      externalSource: 'cal',
      company: 'New Co',
    }

    const result = await ingestLead(noEmailIntake)
    expect(result).toEqual({ ok: true, leadId: 'lead-by-phone', duplicate: true })
    expect(store.updatedRow).toMatchObject({ company: 'New Co' })
  })
})

// ── 4. Note appending ─────────────────────────────────────────────────────────

describe('enrichLead – note appending', () => {
  it('appends notes with separator when existing notes are present', async () => {
    store.existingByEmail = { id: 'lead-1' }
    store.enrichSelectResult = {
      email: 'maria@example.com',
      phone: null,
      company: null,
      notes: 'Original note',
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      ip: null,
      device: null,
      browser: null,
      language: null,
    }

    await ingestLead(calIntake)
    expect(store.updatedRow?.notes).toBe('Original note\n\n---\nMeeting confirmed for Tuesday')
  })

  it('sets notes directly when existing lead has none', async () => {
    store.existingByEmail = { id: 'lead-1' }
    store.enrichSelectResult = {
      email: 'maria@example.com',
      phone: null,
      company: null,
      notes: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      ip: null,
      device: null,
      browser: null,
      language: null,
    }

    await ingestLead(calIntake)
    expect(store.updatedRow?.notes).toBe('Meeting confirmed for Tuesday')
  })

  it('is idempotent: does not append the same note twice', async () => {
    store.existingByEmail = { id: 'lead-1' }
    store.enrichSelectResult = {
      email: 'maria@example.com',
      phone: '+34600111222',
      company: 'Acme SL', // already enriched — no gap to fill
      notes: 'Meeting confirmed for Tuesday', // already there from a previous enrichment
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      referrer: null,
      ip: null,
      device: null,
      browser: null,
      language: null,
    }

    await ingestLead(calIntake)
    // No update should be issued (nothing changed)
    expect(store.updatedRow).toBeNull()
  })
})
