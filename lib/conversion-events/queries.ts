import { createAdminClient } from '@/lib/supabase/admin'

export type ConversionEventRow = {
  id: number
  event_id: string | null
  visitor_id: string | null
  lead_id: string | null
  event_name: string
  conversion_step: string | null
  landing_path: string | null
  landing_ref: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  ip: string | null
  user_agent: string | null
  payload: Record<string, unknown> | null
  created_at: string
  lead: {
    id: string
    name: string
    company: string | null
    email: string | null
  } | null
}

export type ConversionEventsFilters = {
  eventName?: string | null
  leadId?: string | null
  visitorId?: string | null
  limit?: number
}

const EVENT_COLUMNS = `
  id,
  event_id,
  visitor_id,
  lead_id,
  event_name,
  conversion_step,
  landing_path,
  landing_ref,
  referrer,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  ip,
  user_agent,
  payload,
  created_at,
  lead:lead_id(id, name, company, email)
`

function mapLead(value: unknown): ConversionEventRow['lead'] {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  const lead = row as Record<string, unknown>
  if (typeof lead.id !== 'string') return null
  return {
    id: lead.id,
    name: (lead.name as string | null) ?? '',
    company: (lead.company as string | null) ?? null,
    email: (lead.email as string | null) ?? null,
  }
}

function mapEvent(row: Record<string, unknown>): ConversionEventRow {
  return {
    id: Number(row.id),
    event_id: (row.event_id as string | null) ?? null,
    visitor_id: (row.visitor_id as string | null) ?? null,
    lead_id: (row.lead_id as string | null) ?? null,
    event_name: row.event_name as string,
    conversion_step: (row.conversion_step as string | null) ?? null,
    landing_path: (row.landing_path as string | null) ?? null,
    landing_ref: (row.landing_ref as string | null) ?? null,
    referrer: (row.referrer as string | null) ?? null,
    utm_source: (row.utm_source as string | null) ?? null,
    utm_medium: (row.utm_medium as string | null) ?? null,
    utm_campaign: (row.utm_campaign as string | null) ?? null,
    utm_term: (row.utm_term as string | null) ?? null,
    utm_content: (row.utm_content as string | null) ?? null,
    ip: (row.ip as string | null) ?? null,
    user_agent: (row.user_agent as string | null) ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    created_at: row.created_at as string,
    lead: mapLead(row.lead),
  }
}

export async function listConversionEvents(
  filters: ConversionEventsFilters = {},
): Promise<ConversionEventRow[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('conversion_events')
    .select(EVENT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(filters.limit ?? 100, 1), 500))

  if (filters.eventName) query = query.eq('event_name', filters.eventName)
  if (filters.leadId) query = query.eq('lead_id', filters.leadId)
  if (filters.visitorId) query = query.eq('visitor_id', filters.visitorId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapEvent)
}

export async function listLeadConversionEvents(lead: {
  id: string
  event_id?: string | null
}): Promise<ConversionEventRow[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('conversion_events')
    .select(EVENT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(100)

  query = lead.event_id
    ? query.or(`lead_id.eq.${lead.id},event_id.eq.${lead.event_id}`)
    : query.eq('lead_id', lead.id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapEvent)
}
