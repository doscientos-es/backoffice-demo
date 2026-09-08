import type { LeadMemberRef } from '@/lib/leads/types'
import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'
import { escapeIlike } from '@/lib/utils/search-params'

import {
  RECOVERY_KPI_LIMIT,
  RECOVERY_LIST_PAGE_SIZE,
  type RecoveryClosureStatus,
  type RecoveryKpis,
  type RecoveryLead,
  type RecoveryListParams,
  type RecoveryListResult,
  type RecoverySignals,
  type RecoveryState,
} from './types'
import { getRecoveryState } from './utils'

const ASSIGNEE_EMBED = 'assignee:assigned_to(id, name, avatar_url, github_handle)'
const LIST_COLUMNS = `id, name, alias, company, email, phone, source, status, created_at, estimated_value, score, lost_reason, lost_at, assigned_to, ${ASSIGNEE_EMBED}`

/** The two closable statuses that make up the recovery pipeline. */
const CLOSURE_STATUSES: readonly RecoveryClosureStatus[] = ['lost', 'not_interested']

/** Interaction types that count as an outbound recovery touch. */
const OUTBOUND_TYPES = new Set(['email_sent', 'call', 'meeting'])

const log = scopedLogger('recovery.queries')

function mapMemberRef(value: unknown): LeadMemberRef | null {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  const m = row as Record<string, unknown>
  if (typeof m.id !== 'string') return null
  return {
    id: m.id,
    name: (m.name as string | null) ?? '',
    avatar_url: (m.avatar_url as string | null) ?? null,
    github_handle: (m.github_handle as string | null) ?? null,
  }
}

/** True when an event at `iso` happened at/after the lead was lost. */
function afterLost(iso: string | null, lostAt: string | null): boolean {
  if (!iso) return false
  if (!lostAt) return true
  return new Date(iso).getTime() >= new Date(lostAt).getTime()
}

type RecoveryEnrichment = {
  signals: RecoverySignals
  lastContactedAt: string | null
  outreachCount: number
  openCount: number
  clickCount: number
  lastOpenedAt: string | null
  lastClickedAt: string | null
}

/**
 * Loads interactions + campaign sends for a page of lost leads and folds them
 * into per-lead recovery signals. Bounded to the given ids so it stays cheap.
 */
async function loadEnrichment(
  leadIds: string[],
  lostAtById: Map<string, string | null>,
): Promise<Map<string, RecoveryEnrichment>> {
  const byLead = new Map<string, RecoveryEnrichment>()
  if (leadIds.length === 0) return byLead

  const supabase = await createServerClient()
  const [{ data: interactions }, { data: sends }] = await Promise.all([
    supabase
      .from('lead_interactions')
      .select('lead_id, type, created_at, payload')
      .in('lead_id', leadIds),
    supabase
      .from('lead_campaign_sends')
      .select('lead_id, sent_at, opened_at, open_count, clicked_at, click_count')
      .in('lead_id', leadIds),
  ])

  const ensure = (id: string): RecoveryEnrichment => {
    let e = byLead.get(id)
    if (!e) {
      e = {
        signals: { hasOutbound: false, opened: false, clicked: false, replied: false },
        lastContactedAt: null,
        outreachCount: 0,
        openCount: 0,
        clickCount: 0,
        lastOpenedAt: null,
        lastClickedAt: null,
      }
      byLead.set(id, e)
    }
    return e
  }
  const touch = (e: RecoveryEnrichment, at: string | null) => {
    e.signals.hasOutbound = true
    e.outreachCount += 1
    if (at && (!e.lastContactedAt || at > e.lastContactedAt)) e.lastContactedAt = at
  }
  for (const i of interactions ?? []) {
    const id = i.lead_id as string
    const lostAt = lostAtById.get(id) ?? null
    if (!afterLost(i.created_at as string, lostAt)) continue
    const e = ensure(id)
    const type = i.type as string
    const payload = (i.payload as Record<string, unknown> | null) ?? null
    const alreadyTrackedSend =
      type === 'email_sent' && typeof payload?.campaign_send_id === 'string'
    if (OUTBOUND_TYPES.has(type) && !alreadyTrackedSend) touch(e, i.created_at as string)
    if (type === 'email_opened') e.signals.opened = true
    if (type === 'email_clicked') e.signals.clicked = true
    if (type === 'email_received') e.signals.replied = true
  }

  for (const s of sends ?? []) {
    const id = s.lead_id as string | null
    if (!id) continue
    const e = ensure(id)
    touch(e, (s.sent_at as string | null) ?? null)
    const openedAt = (s.opened_at as string | null) ?? null
    const clickedAt = (s.clicked_at as string | null) ?? null
    const opens = Number(s.open_count ?? 0)
    const clicks = Number(s.click_count ?? 0)
    e.openCount += Number.isFinite(opens) ? opens : 0
    e.clickCount += Number.isFinite(clicks) ? clicks : 0
    if (openedAt) {
      e.signals.opened = true
      if (!e.lastOpenedAt || openedAt > e.lastOpenedAt) e.lastOpenedAt = openedAt
    }
    if (clickedAt) {
      e.signals.clicked = true
      if (!e.lastClickedAt || clickedAt > e.lastClickedAt) e.lastClickedAt = clickedAt
    }
  }

  return byLead
}

export async function listLostLeads(params: RecoveryListParams): Promise<RecoveryListResult> {
  const supabase = await createServerClient()

  let query = notDeleted(supabase.from('leads').select(LIST_COLUMNS, { count: 'exact' }))
  query = params.status
    ? query.eq('status', params.status)
    : query.in('status', CLOSURE_STATUSES as unknown as string[])

  if (params.q.length > 0) {
    const pattern = `%${escapeIlike(params.q)}%`
    query = query.or(`name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`)
  }
  if (params.reason) query = query.eq('lost_reason', params.reason)
  if (params.assignee) query = query.eq('assigned_to', params.assignee)

  const from = (params.page - 1) * RECOVERY_LIST_PAGE_SIZE
  const to = from + RECOVERY_LIST_PAGE_SIZE - 1
  const sortCol = params.sort ?? 'lost_at'
  const ascending = params.sort ? params.dir !== 'desc' : false

  const { data, error, count } = await query
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to)

  if (error) log.error({ err: error.message }, 'list_lost_leads_failed')
  const rows = (data ?? []) as Record<string, unknown>[]

  const lostAtById = new Map<string, string | null>(
    rows.map((r) => [r.id as string, (r.lost_at as string | null) ?? null]),
  )
  const enrichment = await loadEnrichment(
    rows.map((r) => r.id as string),
    lostAtById,
  )

  const leads: RecoveryLead[] = rows.map((r) => {
    const e = enrichment.get(r.id as string)
    const state: RecoveryState = getRecoveryState(
      e?.signals ?? { hasOutbound: false, opened: false, clicked: false, replied: false },
    )
    return {
      id: r.id as string,
      name: r.name as string,
      alias: (r.alias as string | null) ?? null,
      company: (r.company as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      source: (r.source as string | null) ?? null,
      status: r.status as RecoveryClosureStatus,
      estimated_value: r.estimated_value == null ? null : Number(r.estimated_value),
      score: r.score == null ? null : Number(r.score),
      lost_reason: (r.lost_reason as string | null) ?? null,
      lost_at: (r.lost_at as string | null) ?? null,
      created_at: r.created_at as string,
      assignee: mapMemberRef(r.assignee),
      recoveryState: state,
      lastContactedAt: e?.lastContactedAt ?? null,
      outreachCount: e?.outreachCount ?? 0,
      openCount: e?.openCount ?? 0,
      clickCount: e?.clickCount ?? 0,
      lastOpenedAt: e?.lastOpenedAt ?? null,
      lastClickedAt: e?.lastClickedAt ?? null,
    }
  })

  return { leads, count: count ?? 0, error: error?.message ?? null }
}

/**
 * Aggregate metrics for the recovery hub KPI cards. Computed across all open
 * lost leads (capped at `RECOVERY_KPI_LIMIT`) rather than the current page so
 * the funnel totals stay accurate regardless of pagination.
 */
export async function getRecoveryKpis(): Promise<RecoveryKpis> {
  const empty: RecoveryKpis = {
    total: 0,
    byState: { pending: 0, contacted: 0, opened: 0, engaged: 0 },
    valueAtRisk: 0,
  }

  const supabase = await createServerClient()
  const { data, error } = await notDeleted(
    supabase.from('leads').select('id, estimated_value, lost_at'),
  )
    .in('status', CLOSURE_STATUSES as unknown as string[])
    .order('lost_at', { ascending: false, nullsFirst: false })
    .limit(RECOVERY_KPI_LIMIT)

  if (error) {
    log.error({ err: error.message }, 'recovery_kpis_failed')
    return empty
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const lostAtById = new Map<string, string | null>(
    rows.map((r) => [r.id as string, (r.lost_at as string | null) ?? null]),
  )
  const enrichment = await loadEnrichment(
    rows.map((r) => r.id as string),
    lostAtById,
  )

  const kpis: RecoveryKpis = {
    total: rows.length,
    byState: { pending: 0, contacted: 0, opened: 0, engaged: 0 },
    valueAtRisk: 0,
  }
  for (const r of rows) {
    const e = enrichment.get(r.id as string)
    const state = getRecoveryState(
      e?.signals ?? { hasOutbound: false, opened: false, clicked: false, replied: false },
    )
    kpis.byState[state] += 1
    if (r.estimated_value != null) kpis.valueAtRisk += Number(r.estimated_value)
  }
  return kpis
}
