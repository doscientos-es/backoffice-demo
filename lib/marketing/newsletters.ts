import { ACTIVE_LEAD_STATUSES } from '@/lib/leads/pipeline'
import { scopedLogger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('marketing.newsletters')

export const NEWSLETTER_AUDIENCES = [
  { key: 'all_leads', label: 'Todos los leads', description: 'Leads con email disponible.' },
  {
    key: 'active_leads',
    label: 'Leads activos',
    description: 'Leads nuevos, en conversación o con propuesta.',
  },
  {
    key: 'calculator_leads',
    label: 'Calculadora',
    description: 'Leads captados desde calculadoras o recursos similares.',
  },
  { key: 'lost_leads', label: 'Repesca', description: 'Leads perdidos o no interesados.' },
  { key: 'clients', label: 'Clientes', description: 'Clientes con email de contacto.' },
] as const

export type NewsletterAudienceKey = (typeof NEWSLETTER_AUDIENCES)[number]['key']

export type NewsletterStatus = 'draft' | 'scheduled' | 'sent' | 'published' | 'archived'

export type NewsletterIssue = {
  id: string
  title: string
  slug: string
  subject: string
  preview_text: string | null
  body_markdown: string
  cta_label: string | null
  cta_url: string | null
  audience_key: NewsletterAudienceKey
  status: NewsletterStatus
  scheduled_at: string | null
  sent_at: string | null
  published_at: string | null
  public_slug: string | null
  lead_campaign_id: string | null
  created_at: string
  updated_at: string
  total_sends: number
  total_opens: number
  total_clicks: number
}

export type NewsletterRecipient = {
  lead_id: string | null
  name: string | null
  company: string | null
  email: string
}

type RawNewsletterIssue = Omit<NewsletterIssue, 'total_sends' | 'total_opens' | 'total_clicks'> & {
  lead_campaign_sends?: { id: string; opened_at: string | null; clicked_at: string | null }[]
}

function mapIssue(row: RawNewsletterIssue): NewsletterIssue {
  const sends = row.lead_campaign_sends ?? []
  return {
    ...row,
    total_sends: sends.length,
    total_opens: sends.filter((send) => send.opened_at).length,
    total_clicks: sends.filter((send) => send.clicked_at).length,
  }
}

export function getAudienceLabel(key: string | null | undefined): string {
  return NEWSLETTER_AUDIENCES.find((audience) => audience.key === key)?.label ?? 'Audiencia'
}

export async function listNewsletterIssues(): Promise<NewsletterIssue[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('newsletter_issues')
    .select(`
      id, title, slug, subject, preview_text, body_markdown, cta_label, cta_url,
      audience_key, status, scheduled_at, sent_at, published_at, public_slug,
      lead_campaign_id, created_at, updated_at
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    log.error({ err: error.message }, 'list_newsletter_issues_failed')
    return []
  }

  const rows = (data ?? []) as unknown as RawNewsletterIssue[]
  const campaignIds = rows
    .map((row) => row.lead_campaign_id)
    .filter((id): id is string => Boolean(id))

  if (campaignIds.length === 0) return rows.map((row) => mapIssue(row))

  const { data: sends, error: sendsError } = await supabase
    .from('lead_campaign_sends')
    .select('campaign_id, id, opened_at, clicked_at')
    .in('campaign_id', campaignIds)
  if (sendsError) {
    log.warn({ err: sendsError.message }, 'list_newsletter_sends_failed')
    return rows.map((row) => mapIssue(row))
  }

  const sendsByCampaign = new Map<string, RawNewsletterIssue['lead_campaign_sends']>()
  for (const send of (sends ?? []) as {
    campaign_id: string
    id: string
    opened_at: string | null
    clicked_at: string | null
  }[]) {
    const current = sendsByCampaign.get(send.campaign_id) ?? []
    current.push({ id: send.id, opened_at: send.opened_at, clicked_at: send.clicked_at })
    sendsByCampaign.set(send.campaign_id, current)
  }

  return rows.map((row) =>
    mapIssue({
      ...row,
      lead_campaign_sends: sendsByCampaign.get(row.lead_campaign_id ?? '') ?? [],
    }),
  )
}

export async function countNewsletterAudience(key: NewsletterAudienceKey): Promise<number> {
  const supabase = await createServerClient()

  if (key === 'clients') {
    const { count, error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .not('email', 'is', null)
      .is('deleted_at', null)
    if (error) log.warn({ err: error.message, key }, 'count_newsletter_audience_failed')
    return count ?? 0
  }

  let query = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .not('email', 'is', null)
    .is('deleted_at', null)

  if (key === 'active_leads') query = query.in('status', [...ACTIVE_LEAD_STATUSES])
  if (key === 'calculator_leads') query = query.ilike('source', '%calcul%')
  if (key === 'lost_leads') query = query.in('status', ['lost', 'not_interested'])

  const { count, error } = await query
  if (error) log.warn({ err: error.message, key }, 'count_newsletter_audience_failed')
  return count ?? 0
}

export async function getNewsletterIssue(id: string): Promise<NewsletterIssue | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('newsletter_issues')
    .select(`
      id, title, slug, subject, preview_text, body_markdown, cta_label, cta_url,
      audience_key, status, scheduled_at, sent_at, published_at, public_slug,
      lead_campaign_id, created_at, updated_at
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    if (error) log.error({ err: error.message, id }, 'get_newsletter_issue_failed')
    return null
  }

  return mapIssue(data as unknown as RawNewsletterIssue)
}

export async function listNewsletterRecipients(
  key: NewsletterAudienceKey,
): Promise<NewsletterRecipient[]> {
  const supabase = await createServerClient()

  const { data: unsubscribed } = await supabase
    .from('lead_campaign_sends')
    .select('email')
    .not('unsubscribed_at', 'is', null)
  const blockedEmails = new Set(
    ((unsubscribed ?? []) as { email: string }[]).map((row) => row.email.toLowerCase()),
  )

  if (key === 'clients') {
    const { data, error } = await supabase
      .from('clients')
      .select('name, email')
      .not('email', 'is', null)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(500)
    if (error) {
      log.error({ err: error.message, key }, 'list_newsletter_recipients_failed')
      return []
    }
    return ((data ?? []) as { name: string | null; email: string | null }[])
      .filter((row) => row.email && !blockedEmails.has(row.email.toLowerCase()))
      .map((row) => ({
        lead_id: null,
        name: row.name,
        company: row.name,
        email: row.email as string,
      }))
  }

  let query = supabase
    .from('leads')
    .select('id, name, company, email')
    .not('email', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (key === 'active_leads') query = query.in('status', [...ACTIVE_LEAD_STATUSES])
  if (key === 'calculator_leads') query = query.ilike('source', '%calcul%')
  if (key === 'lost_leads') query = query.in('status', ['lost', 'not_interested'])

  const { data, error } = await query
  if (error) {
    log.error({ err: error.message, key }, 'list_newsletter_recipients_failed')
    return []
  }

  return (
    (data ?? []) as {
      id: string
      name: string | null
      company: string | null
      email: string | null
    }[]
  )
    .filter((row) => row.email && !blockedEmails.has(row.email.toLowerCase()))
    .map((row) => ({
      lead_id: row.id,
      name: row.name,
      company: row.company,
      email: row.email as string,
    }))
}
