import { normalizeLeadSource } from '@/lib/leads/constants'
import { scopedLogger } from '@/lib/logger'
import type { LeadStatus } from '@/lib/status'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('leads.analytics')

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const PIPELINE_STAGES = [
  'new',
  'contacted',
  'in_conversation',
  'quoted',
  'won',
  'lost',
  'not_interested',
  'archived',
] as const

type PipelineStage = (typeof PIPELINE_STAGES)[number]

const STAGE_RANK: Readonly<Record<PipelineStage, number>> = {
  new: 0,
  contacted: 1,
  in_conversation: 2,
  quoted: 3,
  won: 4,
  lost: 4,
  not_interested: 4,
  archived: 4,
}

const STAGE_LABEL: Readonly<Record<PipelineStage, string>> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  in_conversation: 'En conversación',
  quoted: 'Presupuestado',
  won: 'Ganado',
  lost: 'Perdido',
  not_interested: 'No interesa',
  archived: 'Archivado',
}

const STAGE_COLOR: Readonly<Record<PipelineStage, string>> = {
  new: '#2563eb',
  contacted: '#0f766e',
  in_conversation: '#ca8a04',
  quoted: '#f97316',
  won: '#16a34a',
  lost: '#dc2626',
  not_interested: '#737373',
  archived: '#a3a3a3',
}

const SOURCE_COLORS = ['#6366f1', '#0891b2', '#7c3aed', '#db2777', '#059669', '#d97706']
const TERMINAL_STAGES = new Set<PipelineStage>(['won', 'lost', 'not_interested', 'archived'])

export type AnalyticsLead = {
  id: string
  source: string | null
  status: LeadStatus | string
  created_at: string
}

export type LeadStatusEvent = {
  lead_id: string
  created_at: string
  payload: unknown
}

export type SankeyNode = { id: string; label: string; color: string }
export type SankeyLink = { source: string; target: string; value: number }
export type FunnelStage = {
  id: PipelineStage
  label: string
  value: number
  rate: number
  color: string
}
export type SourcePerformance = { source: string; leads: number; won: number; rate: number }
export type LeadTrendPoint = { week: string; entradas: number; ganados: number; perdidos: number }

export type LeadJourneyAnalytics = {
  total: number
  won: number
  lost: number
  conversionRate: number
  mainLeak: { label: string; value: number } | null
  sankeyNodes: SankeyNode[]
  sankeyLinks: SankeyLink[]
  funnel: FunnelStage[]
  sourcePerformance: SourcePerformance[]
  trend: LeadTrendPoint[]
}

function stageFrom(value: unknown): PipelineStage | null {
  const normalized = value === 'qualifying' ? 'in_conversation' : value
  return typeof normalized === 'string' && PIPELINE_STAGES.includes(normalized as PipelineStage)
    ? (normalized as PipelineStage)
    : null
}

function eventTarget(payload: unknown): PipelineStage | null {
  if (!payload || typeof payload !== 'object' || !('to' in payload)) return null
  return stageFrom((payload as { to?: unknown }).to)
}

function sourceName(source: string | null): string {
  return normalizeLeadSource(source) ?? 'Sin origen'
}

function sourceId(source: string): string {
  return `source:${source}`
}

function stageId(stage: PipelineStage): string {
  return `stage:${stage}`
}

/**
 * Produces one acyclic first-pass journey for Sankey and funnel views. Reopened
 * leads can otherwise create backwards links (e.g. lost → conversation), which
 * makes a Sankey misleading; the recovery workflow reports those separately.
 */
function buildJourney(lead: AnalyticsLead, events: LeadStatusEvent[]): PipelineStage[] {
  const journey: PipelineStage[] = ['new']
  let lastStage: PipelineStage = 'new'

  for (const event of events.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const next = eventTarget(event.payload)
    if (!next || next === lastStage || STAGE_RANK[next] < STAGE_RANK[lastStage]) continue
    journey.push(next)
    lastStage = next
    if (TERMINAL_STAGES.has(next)) return journey
  }

  const current = stageFrom(lead.status)
  if (current && current !== lastStage && STAGE_RANK[current] >= STAGE_RANK[lastStage]) {
    journey.push(current)
  }
  return journey
}

function weekKey(value: string): string {
  const date = new Date(value)
  const weekday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - weekday)
  return isoDate(date)
}

function formatWeek(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T12:00:00Z`),
  )
}

function buildTrend(
  since: string,
  until: string,
  leads: AnalyticsLead[],
  outcomeEvents: LeadStatusEvent[],
): LeadTrendPoint[] {
  const byWeek = new Map<string, LeadTrendPoint>()
  for (
    let cursor = new Date(`${weekKey(since)}T00:00:00Z`);
    cursor <= new Date(`${until}T23:59:59Z`);
  ) {
    const key = isoDate(cursor)
    byWeek.set(key, { week: formatWeek(key), entradas: 0, ganados: 0, perdidos: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  for (const lead of leads) {
    const point = byWeek.get(weekKey(lead.created_at))
    if (point) point.entradas += 1
  }
  for (const event of outcomeEvents) {
    const point = byWeek.get(weekKey(event.created_at))
    if (!point) continue
    const target = eventTarget(event.payload)
    if (target === 'won') point.ganados += 1
    if (target === 'lost' || target === 'not_interested') point.perdidos += 1
  }
  return [...byWeek.values()]
}

export function buildLeadJourneyAnalytics(
  leads: AnalyticsLead[],
  events: LeadStatusEvent[],
  outcomeEvents: LeadStatusEvent[],
  since: string,
  until: string,
): LeadJourneyAnalytics {
  const eventsByLead = new Map<string, LeadStatusEvent[]>()
  for (const event of events) {
    const list = eventsByLead.get(event.lead_id) ?? []
    list.push(event)
    eventsByLead.set(event.lead_id, list)
  }

  const links = new Map<string, SankeyLink>()
  const reached = new Map<PipelineStage, number>()
  const sources = new Map<string, { leads: number; won: number }>()

  for (const lead of leads) {
    const source = sourceName(lead.source)
    const sourceStats = sources.get(source) ?? { leads: 0, won: 0 }
    sourceStats.leads += 1
    sources.set(source, sourceStats)

    const journey = buildJourney(lead, eventsByLead.get(lead.id) ?? [])
    if (journey.includes('won')) sourceStats.won += 1

    const ids = [sourceId(source), ...journey.map(stageId)]
    for (const stage of new Set(journey)) reached.set(stage, (reached.get(stage) ?? 0) + 1)
    for (let index = 0; index < ids.length - 1; index += 1) {
      const sourceIdValue = ids[index]
      const targetIdValue = ids[index + 1]
      if (!sourceIdValue || !targetIdValue) continue
      const key = `${sourceIdValue}\u0000${targetIdValue}`
      const link = links.get(key) ?? { source: sourceIdValue, target: targetIdValue, value: 0 }
      link.value += 1
      links.set(key, link)
    }
  }

  const sortedSources = [...sources.keys()].sort((a, b) => a.localeCompare(b, 'es'))
  const sankeyNodes: SankeyNode[] = [
    ...sortedSources.map((source, index) => ({
      id: sourceId(source),
      label: source,
      color: SOURCE_COLORS[index % SOURCE_COLORS.length] ?? '#6366f1',
    })),
    ...PIPELINE_STAGES.filter((stage) => (reached.get(stage) ?? 0) > 0).map((stage) => ({
      id: stageId(stage),
      label: STAGE_LABEL[stage],
      color: STAGE_COLOR[stage],
    })),
  ]

  const total = leads.length
  const won = reached.get('won') ?? 0
  const lost = (reached.get('lost') ?? 0) + (reached.get('not_interested') ?? 0)
  const funnel = PIPELINE_STAGES.filter((stage) => (reached.get(stage) ?? 0) > 0).map((stage) => ({
    id: stage,
    label: STAGE_LABEL[stage],
    value: reached.get(stage) ?? 0,
    rate: total > 0 ? ((reached.get(stage) ?? 0) / total) * 100 : 0,
    color: STAGE_COLOR[stage],
  }))
  const sourcePerformance = [...sources.entries()]
    .map(([source, values]) => ({
      source,
      ...values,
      rate: values.leads > 0 ? (values.won / values.leads) * 100 : 0,
    }))
    .sort((a, b) => b.leads - a.leads || b.rate - a.rate)
  const mainLeak = (links.get(`${stageId('quoted')}\u0000${stageId('lost')}`) ??
    links.get(`${stageId('quoted')}\u0000${stageId('not_interested')}`) ??
    null) as SankeyLink | null

  return {
    total,
    won,
    lost,
    conversionRate: total > 0 ? (won / total) * 100 : 0,
    mainLeak: mainLeak ? { label: 'Tras presupuesto', value: mainLeak.value } : null,
    sankeyNodes,
    sankeyLinks: [...links.values()],
    funnel,
    sourcePerformance,
    trend: buildTrend(since, until, leads, outcomeEvents),
  }
}

export async function getLeadJourneyAnalytics(input: {
  since: string
  until: string
}): Promise<{ analytics: LeadJourneyAnalytics | null; error: string | null }> {
  const supabase = await createServerClient()
  const start = `${input.since}T00:00:00.000Z`
  const end = `${input.until}T23:59:59.999Z`
  const { data: leadData, error: leadError } = await notDeleted(
    supabase
      .from('leads')
      .select('id, source, status, created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
  )

  if (leadError) {
    log.error({ err: leadError }, 'lead analytics query failed')
    return { analytics: null, error: 'No se pudieron cargar los leads.' }
  }

  const leads = ((leadData ?? []) as unknown as AnalyticsLead[]).filter((lead) => lead.id)
  const leadIds = leads.map((lead) => lead.id)
  const batches = Array.from({ length: Math.ceil(leadIds.length / 250) }, (_, index) =>
    leadIds.slice(index * 250, (index + 1) * 250),
  )
  const eventResults = await Promise.all(
    batches.map((ids) =>
      supabase
        .from('lead_interactions')
        .select('lead_id, created_at, payload')
        .eq('type', 'status_change')
        .in('lead_id', ids)
        .order('created_at', { ascending: true }),
    ),
  )
  const failedEventQuery = eventResults.find((result) => result.error)
  if (failedEventQuery?.error) {
    log.error({ err: failedEventQuery.error }, 'lead journey events query failed')
    return { analytics: null, error: 'No se pudo cargar el historial de etapas.' }
  }

  const { data: outcomeData, error: outcomeError } = await supabase
    .from('lead_interactions')
    .select('lead_id, created_at, payload')
    .eq('type', 'status_change')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true })
  if (outcomeError) {
    log.error({ err: outcomeError }, 'lead outcome events query failed')
    return { analytics: null, error: 'No se pudo cargar la evolución del embudo.' }
  }

  const events = eventResults.flatMap(
    (result) => (result.data ?? []) as unknown as LeadStatusEvent[],
  )
  const outcomeEvents = (outcomeData ?? []) as unknown as LeadStatusEvent[]
  return {
    analytics: buildLeadJourneyAnalytics(leads, events, outcomeEvents, input.since, input.until),
    error: null,
  }
}
