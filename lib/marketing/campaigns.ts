import { scopedLogger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('marketing.campaigns')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'paused'

export type LeadCampaign = {
  id: string
  name: string
  subject: string
  body_html: string
  status: CampaignStatus
  created_by: string | null
  created_at: string
  updated_at: string
  /** Derived stats — populated by listCampaigns. */
  total_sends: number
  total_opens: number
  total_clicks: number
}

export type LeadCampaignSend = {
  id: string
  campaign_id: string
  lead_id: string | null
  /** Lead name, resolved via join. */
  lead_name: string | null
  email: string
  tracking_token: string
  resend_email_id: string | null
  sent_at: string | null
  opened_at: string | null
  open_count: number
  clicked_at: string | null
  click_count: number
  bounced_at: string | null
  unsubscribed_at: string | null
  created_at: string
}

export type CampaignStats = {
  total: number
  sent: number
  opened: number
  clicked: number
  bounced: number
  open_rate: number
  click_rate: number
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listCampaigns(): Promise<LeadCampaign[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('lead_campaigns')
    .select(`
      id, name, subject, body_html, status, created_by, created_at, updated_at,
      sends:lead_campaign_sends(id, opened_at, clicked_at)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    log.error({ err: error.message }, 'list_campaigns_failed')
    return []
  }

  return (data ?? []).map((c) => {
    const sends =
      (c.sends as { id: string; opened_at: string | null; clicked_at: string | null }[]) ?? []
    return {
      id: c.id as string,
      name: c.name as string,
      subject: c.subject as string,
      body_html: c.body_html as string,
      status: c.status as CampaignStatus,
      created_by: (c.created_by as string | null) ?? null,
      created_at: c.created_at as string,
      updated_at: c.updated_at as string,
      total_sends: sends.length,
      total_opens: sends.filter((s) => s.opened_at).length,
      total_clicks: sends.filter((s) => s.clicked_at).length,
    }
  })
}

export async function getCampaignWithSends(
  id: string,
): Promise<{ campaign: LeadCampaign; sends: LeadCampaignSend[]; stats: CampaignStats } | null> {
  const supabase = await createServerClient()

  const [{ data: campaign, error }, { data: sends }] = await Promise.all([
    supabase
      .from('lead_campaigns')
      .select('id, name, subject, body_html, status, created_by, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('lead_campaign_sends')
      .select(
        'id, campaign_id, lead_id, email, tracking_token, resend_email_id, sent_at, opened_at, open_count, clicked_at, click_count, bounced_at, unsubscribed_at, created_at, lead:lead_id(name)',
      )
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (error || !campaign) return null

  const rows = (sends ?? []) as Record<string, unknown>[]
  const mappedSends: LeadCampaignSend[] = rows.map((s) => {
    const leadRel = s.lead as { name?: string } | null
    return {
      id: s.id as string,
      campaign_id: s.campaign_id as string,
      lead_id: (s.lead_id as string | null) ?? null,
      lead_name: leadRel?.name ?? null,
      email: s.email as string,
      tracking_token: s.tracking_token as string,
      resend_email_id: (s.resend_email_id as string | null) ?? null,
      sent_at: (s.sent_at as string | null) ?? null,
      opened_at: (s.opened_at as string | null) ?? null,
      open_count: (s.open_count as number) ?? 0,
      clicked_at: (s.clicked_at as string | null) ?? null,
      click_count: (s.click_count as number) ?? 0,
      bounced_at: (s.bounced_at as string | null) ?? null,
      unsubscribed_at: (s.unsubscribed_at as string | null) ?? null,
      created_at: s.created_at as string,
    }
  })

  const total = mappedSends.length
  const sent = mappedSends.filter((s) => s.sent_at).length
  const opened = mappedSends.filter((s) => s.opened_at).length
  const clicked = mappedSends.filter((s) => s.clicked_at).length
  const bounced = mappedSends.filter((s) => s.bounced_at).length

  const stats: CampaignStats = {
    total,
    sent,
    opened,
    clicked,
    bounced,
    open_rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    click_rate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
  }

  return {
    campaign: {
      ...(campaign as unknown as Omit<
        LeadCampaign,
        'total_sends' | 'total_opens' | 'total_clicks'
      >),
      total_sends: total,
      total_opens: opened,
      total_clicks: clicked,
    },
    sends: mappedSends,
    stats,
  }
}
