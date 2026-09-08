import { cache } from 'react'

import { META_LEAD_SOURCE } from '@/lib/integrations/meta-leads'
import { normalizeLeadSource } from '@/lib/leads/constants'
import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

import type { MarketingSort, MarketingView } from './range'
import { computeMarketingRoi, type MarketingRoi } from './roi'
import type {
  ActiveAdRow,
  CampaignRow,
  CampaignsOverview,
  InsightsBreakdown,
  InsightsBreakdownPoint,
  InsightsSeriesMeta,
  MarketingOverview,
  RawAdRow,
  RawInsightRow,
} from './types'
import { INSIGHTS_OTHERS_KEY } from './types'

const log = scopedLogger('marketing.queries')

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

function weightedAvg(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0
}

function aggregateInsights(insights: RawInsightRow[]) {
  const spend = sum(insights.map((i) => i.spend))
  const impressions = sum(insights.map((i) => i.impressions))
  const clicks = sum(insights.map((i) => i.clicks))
  const outboundClicks = sum(insights.map((i) => i.outbound_clicks))
  const landingPageViews = sum(insights.map((i) => i.landing_page_views))
  const leads = sum(insights.map((i) => i.total_leads))
  // CTR / CPC are recomputed from totals so they remain accurate across days,
  // instead of averaging Meta's per-row ratios.
  const ctr = weightedAvg(clicks * 100, impressions)
  const cpc = weightedAvg(spend, clicks)
  const cpl = weightedAvg(spend, leads)
  const currency = insights.find((i) => i.currency)?.currency ?? 'EUR'
  return {
    spend,
    impressions,
    clicks,
    outboundClicks,
    landingPageViews,
    leads,
    ctr,
    cpc,
    cpl,
    currency,
  }
}

const COMPARATORS: Record<MarketingSort, (a: ActiveAdRow, b: ActiveAdRow) => number> = {
  spend_desc: (a, b) => b.spend - a.spend,
  spend_asc: (a, b) => a.spend - b.spend,
  leads_desc: (a, b) => b.leads - a.leads,
  // Ads with zero leads are pushed to the bottom under "best CPL"
  cpl_asc: (a, b) => (a.leads === 0 ? 1 : b.leads === 0 ? -1 : a.cpl - b.cpl),
  ctr_desc: (a, b) => b.ctr - a.ctr,
  name_asc: (a, b) => a.name.localeCompare(b.name, 'es'),
}

export type AdsOverviewOptions = {
  since: string
  until: string
  includePaused?: boolean
  sort?: MarketingSort
}

export async function getActiveAdsOverview(opts: AdsOverviewOptions): Promise<MarketingOverview> {
  const supabase = await createServerClient()

  // marketing_* tables hold external data from Meta and do not use the soft-delete convention.
  let query = supabase.from('marketing_ads').select(
    `id, name, status, preview_url, destination_url, call_to_action_type, lead_form_id, updated_at,
       marketing_campaigns ( name ),
       marketing_insights ( spend, impressions, clicks, inline_link_clicks, outbound_clicks, unique_outbound_clicks, landing_page_views, ctr, cpc, total_leads, cost_per_lead, currency, date_start, date_stop )`,
  )
  if (!opts.includePaused) query = query.eq('status', 'ACTIVE')

  const { data: adsData, error: adsErr } = await query
  if (adsErr) log.error({ err: adsErr }, 'marketing_ads query failed')

  const ads = (adsData as unknown as RawAdRow[]) || []
  const sortKey: MarketingSort = opts.sort ?? 'spend_desc'

  const processedAds: ActiveAdRow[] = ads.map((ad) => {
    // Filter insights to the selected window. `date_start` is a `YYYY-MM-DD`
    // string from Supabase, so lexicographic compare matches calendar order.
    // `date_start === date_stop` keeps only true daily rows, ignoring any legacy
    // aggregate row (date_start = since, date_stop = until) that would otherwise
    // pile a whole period's totals onto a single day.
    const insights = (ad.marketing_insights ?? []).filter(
      (i) =>
        i.date_start &&
        i.date_start === i.date_stop &&
        i.date_start >= opts.since &&
        i.date_start <= opts.until,
    )
    const agg = aggregateInsights(insights)
    const campaign = Array.isArray(ad.marketing_campaigns)
      ? ad.marketing_campaigns[0]
      : ad.marketing_campaigns

    return {
      id: ad.id,
      name: ad.name,
      status: ad.status || 'UNKNOWN',
      preview_url: ad.preview_url || null,
      destinationUrl: ad.destination_url || null,
      callToActionType: ad.call_to_action_type || null,
      leadFormId: ad.lead_form_id || null,
      campaignName: campaign?.name || 'Sin campaña',
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      outboundClicks: agg.outboundClicks,
      landingPageViews: agg.landingPageViews,
      leads: agg.leads,
      ctr: agg.ctr,
      cpc: agg.cpc,
      cpl: agg.cpl,
      currency: agg.currency,
    }
  })

  processedAds.sort(COMPARATORS[sortKey])

  const totalSpent = sum(processedAds.map((a) => a.spend))
  const totalImpressions = sum(processedAds.map((a) => a.impressions))
  const totalClicks = sum(processedAds.map((a) => a.clicks))
  const totalOutboundClicks = sum(processedAds.map((a) => a.outboundClicks))
  const totalLandingPageViews = sum(processedAds.map((a) => a.landingPageViews))
  const totalLeads = sum(processedAds.map((a) => a.leads))
  const currency = processedAds.find((a) => a.currency)?.currency ?? 'EUR'
  const lastSyncAt = ads.reduce<string | null>((max, a) => {
    if (!a.updated_at) return max
    return !max || a.updated_at > max ? a.updated_at : max
  }, null)

  return {
    ads: processedAds,
    totalSpent,
    totalLeads,
    totalImpressions,
    totalClicks,
    totalOutboundClicks,
    totalLandingPageViews,
    avgCpl: weightedAvg(totalSpent, totalLeads),
    avgCtr: weightedAvg(totalClicks * 100, totalImpressions),
    avgCpc: weightedAvg(totalSpent, totalClicks),
    currency,
    lastSyncAt,
  }
}

const CAMPAIGN_COMPARATORS: Record<MarketingSort, (a: CampaignRow, b: CampaignRow) => number> = {
  spend_desc: (a, b) => b.spend - a.spend,
  spend_asc: (a, b) => a.spend - b.spend,
  leads_desc: (a, b) => b.leads - a.leads,
  cpl_asc: (a, b) => (a.leads === 0 ? 1 : b.leads === 0 ? -1 : a.cpl - b.cpl),
  ctr_desc: (a, b) => b.ctr - a.ctr,
  name_asc: (a, b) => a.name.localeCompare(b.name, 'es'),
}

export type CampaignsOverviewOptions = {
  since: string
  until: string
  sort?: MarketingSort
}

/**
 * Aggregates already-synced ad-level insights into per-campaign totals. We
 * derive this from `marketing_ads → marketing_insights` instead of calling
 * Meta's campaign-level endpoint to avoid an extra API hit on every render
 * and to keep the same `since/until` window as the ads view.
 */
export async function getCampaignsOverview(
  opts: CampaignsOverviewOptions,
): Promise<CampaignsOverview> {
  const supabase = await createServerClient()

  const { data: adsData, error: adsErr } = await supabase.from('marketing_ads').select(
    `id, status, updated_at, campaign_id,
       marketing_campaigns ( id, name, status, objective ),
       marketing_insights ( spend, impressions, clicks, inline_link_clicks, outbound_clicks, unique_outbound_clicks, landing_page_views, ctr, cpc, total_leads, cost_per_lead, currency, date_start, date_stop )`,
  )
  if (adsErr) log.error({ err: adsErr }, 'marketing_ads (campaign view) query failed')

  const ads = (adsData as unknown as RawAdRow[]) || []

  const byCampaign = new Map<string, { row: CampaignRow; insights: RawInsightRow[] }>()

  for (const ad of ads) {
    const campaign = Array.isArray(ad.marketing_campaigns)
      ? ad.marketing_campaigns[0]
      : ad.marketing_campaigns
    const campaignId = campaign?.id ?? ad.campaign_id ?? '__none__'
    const insights = (ad.marketing_insights ?? []).filter(
      (i) =>
        i.date_start &&
        i.date_start === i.date_stop &&
        i.date_start >= opts.since &&
        i.date_start <= opts.until,
    )

    let bucket = byCampaign.get(campaignId)
    if (!bucket) {
      bucket = {
        row: {
          id: campaignId,
          name: campaign?.name || 'Sin campaña',
          status: campaign?.status || 'UNKNOWN',
          objective: campaign?.objective ?? null,
          adCount: 0,
          activeAdCount: 0,
          spend: 0,
          impressions: 0,
          clicks: 0,
          outboundClicks: 0,
          landingPageViews: 0,
          leads: 0,
          ctr: 0,
          cpc: 0,
          cpl: 0,
          currency: 'EUR',
        },
        insights: [],
      }
      byCampaign.set(campaignId, bucket)
    }
    bucket.row.adCount += 1
    if (ad.status === 'ACTIVE') bucket.row.activeAdCount += 1
    bucket.insights.push(...insights)
  }

  const campaigns: CampaignRow[] = Array.from(byCampaign.values()).map(({ row, insights }) => {
    const agg = aggregateInsights(insights)
    return {
      ...row,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      outboundClicks: agg.outboundClicks,
      landingPageViews: agg.landingPageViews,
      leads: agg.leads,
      ctr: agg.ctr,
      cpc: agg.cpc,
      cpl: agg.cpl,
      currency: agg.currency,
    }
  })

  const sortKey: MarketingSort = opts.sort ?? 'spend_desc'
  campaigns.sort(CAMPAIGN_COMPARATORS[sortKey])

  const totalSpent = sum(campaigns.map((c) => c.spend))
  const totalImpressions = sum(campaigns.map((c) => c.impressions))
  const totalClicks = sum(campaigns.map((c) => c.clicks))
  const totalOutboundClicks = sum(campaigns.map((c) => c.outboundClicks))
  const totalLandingPageViews = sum(campaigns.map((c) => c.landingPageViews))
  const totalLeads = sum(campaigns.map((c) => c.leads))
  const currency = campaigns.find((c) => c.spend > 0)?.currency ?? 'EUR'
  const lastSyncAt = ads.reduce<string | null>((max, a) => {
    if (!a.updated_at) return max
    return !max || a.updated_at > max ? a.updated_at : max
  }, null)

  return {
    campaigns,
    totalSpent,
    totalLeads,
    totalImpressions,
    totalClicks,
    totalOutboundClicks,
    totalLandingPageViews,
    avgCpl: weightedAvg(totalSpent, totalLeads),
    avgCtr: weightedAvg(totalClicks * 100, totalImpressions),
    avgCpc: weightedAvg(totalSpent, totalClicks),
    currency,
    lastSyncAt,
  }
}

export type BreakdownOptions = {
  since: string
  until: string
  dimension: MarketingView
}

/** Number of top spenders shown as their own stacked series before "Otros". */
const INSIGHTS_TOP_SERIES = 6

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Daily spend for the evolution chart, broken down by the active dimension (ad
 * or campaign). Walks `marketing_ads → marketing_insights` so each daily row
 * keeps its ad/campaign identity, then keeps the top spenders as their own
 * stacked series and folds the rest into a single "Otros" bucket so the chart
 * stays readable. `leads` and `total` are account-wide per day, independent of
 * how spend is split, so the leads line and the stack height stay accurate.
 */
export async function getInsightsBreakdownSeries(
  opts: BreakdownOptions,
): Promise<InsightsBreakdown> {
  const supabase = await createServerClient()

  const { data: adsData, error } = await supabase.from('marketing_ads').select(
    `id, name, campaign_id,
       marketing_campaigns ( id, name ),
       marketing_insights ( spend, total_leads, date_start, date_stop )`,
  )
  if (error) log.error({ err: error }, 'marketing_insights breakdown query failed')

  const ads = (adsData as unknown as RawAdRow[]) || []

  const entityLabel = new Map<string, string>()
  const entityTotal = new Map<string, number>()
  const spendByDayEntity = new Map<string, Map<string, number>>()
  const leadsByDay = new Map<string, number>()

  for (const ad of ads) {
    const campaign = Array.isArray(ad.marketing_campaigns)
      ? ad.marketing_campaigns[0]
      : ad.marketing_campaigns
    const key =
      opts.dimension === 'campaigns' ? (campaign?.id ?? ad.campaign_id ?? '__none__') : ad.id
    const label =
      opts.dimension === 'campaigns' ? campaign?.name || 'Sin campaña' : ad.name || 'Sin nombre'
    entityLabel.set(key, label)

    for (const i of ad.marketing_insights ?? []) {
      // Daily rows only (date_start === date_stop); ignore period aggregates.
      if (!i.date_start || i.date_start !== i.date_stop) continue
      if (i.date_start < opts.since || i.date_start > opts.until) continue

      const spend = i.spend ?? 0
      entityTotal.set(key, (entityTotal.get(key) ?? 0) + spend)
      leadsByDay.set(i.date_start, (leadsByDay.get(i.date_start) ?? 0) + (i.total_leads ?? 0))

      let dayMap = spendByDayEntity.get(i.date_start)
      if (!dayMap) {
        dayMap = new Map()
        spendByDayEntity.set(i.date_start, dayMap)
      }
      dayMap.set(key, (dayMap.get(key) ?? 0) + spend)
    }
  }

  // Rank by total spend and keep the top N as their own series; everything
  // else collapses into "Otros".
  const topKeys = Array.from(entityTotal.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, INSIGHTS_TOP_SERIES)
    .map(([key]) => key)
  const topSet = new Set(topKeys)
  const hasOthers = Array.from(entityLabel.keys()).some((k) => !topSet.has(k))

  const series: InsightsSeriesMeta[] = topKeys.map((key) => ({
    key,
    label: entityLabel.get(key) ?? key,
  }))
  if (hasOthers) series.push({ key: INSIGHTS_OTHERS_KEY, label: 'Otros' })

  const points: InsightsBreakdownPoint[] = Array.from(spendByDayEntity.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMap]) => {
      const point: InsightsBreakdownPoint = {
        date,
        total: 0,
        leads: leadsByDay.get(date) ?? 0,
      }
      // Seed every series so Recharts always resolves each dynamic dataKey.
      for (const key of topKeys) point[key] = 0
      if (hasOthers) point[INSIGHTS_OTHERS_KEY] = 0

      let total = 0
      for (const [key, spend] of dayMap) {
        total += spend
        const bucket = topSet.has(key) ? key : INSIGHTS_OTHERS_KEY
        point[bucket] = round2((point[bucket] as number) + spend)
      }
      point.total = round2(total)
      return point
    })

  return { dimension: opts.dimension, points, series }
}

export type MarketingOverviewResult =
  | ({ view: 'ads' } & MarketingOverview)
  | ({ view: 'campaigns' } & CampaignsOverview)

/**
 * Unified overview resolver shared by the KPI and table sections. Wrapped in
 * React `cache()` with primitive arguments so both sections (rendered in
 * parallel under their own Suspense boundaries) trigger a single DB round-trip
 * per request instead of fetching the same data twice.
 */
export const getMarketingOverview = cache(
  async (
    view: MarketingView,
    since: string,
    until: string,
    sort: MarketingSort,
    showPaused: boolean,
  ): Promise<MarketingOverviewResult> => {
    if (view === 'campaigns') {
      const overview = await getCampaignsOverview({ since, until, sort })
      return { view: 'campaigns', ...overview }
    }
    const overview = await getActiveAdsOverview({ since, until, includePaused: showPaused, sort })
    return { view: 'ads', ...overview }
  },
)

// --- CAC / ROAS -------------------------------------------------------------

/** End-of-day boundary so a `date` window also captures same-day timestamps. */
function endOfDay(date: string): string {
  return `${date}T23:59:59.999`
}

/**
 * Closes the marketing loop for the Meta Ads channel: ties the spend Meta
 * reported to the customers it actually produced and the revenue they invoiced.
 *
 * Attribution chain: a Meta lead (`leads.external_source = META_LEAD_SOURCE`)
 * converted into a `clients` row within the window counts as one acquisition;
 * its lifetime non-draft invoices are the attributed revenue. See `roi.ts` for
 * why revenue is lifetime rather than windowed.
 */
export async function getMarketingRoi(since: string, until: string): Promise<MarketingRoi> {
  const supabase = await createServerClient()

  // 1. Spend + leads from Meta insights. Keep only true daily rows in the
  //    window (date_start === date_stop) to avoid double-counting any legacy
  //    period-aggregate row, mirroring the overview queries.
  const { data: insightRows, error: insightErr } = await supabase
    .from('marketing_insights')
    .select('spend, total_leads, currency, date_start, date_stop')
  if (insightErr) log.error({ err: insightErr.message }, 'roi_insights_failed')
  const insights = ((insightRows as unknown as RawInsightRow[]) ?? []).filter(
    (i) =>
      i.date_start &&
      i.date_start === i.date_stop &&
      i.date_start >= since &&
      i.date_start <= until,
  )
  const spend = sum(insights.map((i) => i.spend))
  const leads = sum(insights.map((i) => i.total_leads))
  const currency = insights.find((i) => i.currency)?.currency ?? 'EUR'

  // Commercial outcome for every acquisition channel. This is intentionally
  // separate from Meta's reported lead count: it reflects the CRM truth.
  const { data: closedLeadRows, error: closedLeadsErr } = await notDeleted(
    supabase
      .from('leads')
      .select('status, estimated_value')
      .gte('created_at', since)
      .lte('created_at', endOfDay(until)),
  )
  if (closedLeadsErr) log.error({ err: closedLeadsErr.message }, 'roi_closed_leads_failed')
  const periodLeads = (closedLeadRows ?? []) as Array<{
    status: string | null
    estimated_value: number | null
  }>
  const closedLeads = periodLeads.filter((lead) => lead.status === 'won')
  const closedPipelineValue = sum(closedLeads.map((lead) => lead.estimated_value))

  // 2. Clients acquired in the window from a Meta-sourced lead.
  const { data: metaLeads, error: leadsErr } = await notDeleted(
    supabase.from('leads').select('id').eq('external_source', META_LEAD_SOURCE),
  )
  if (leadsErr) log.error({ err: leadsErr.message }, 'roi_meta_leads_failed')
  const metaLeadIds = (metaLeads ?? []).map((l) => l.id as string)

  let acquiredClientIds: string[] = []
  if (metaLeadIds.length > 0) {
    const { data: clientRows, error: clientsErr } = await notDeleted(
      supabase
        .from('clients')
        .select('id')
        .in('lead_id', metaLeadIds)
        .gte('created_at', since)
        .lte('created_at', endOfDay(until)),
    )
    if (clientsErr) log.error({ err: clientsErr.message }, 'roi_clients_failed')
    acquiredClientIds = (clientRows ?? []).map((c) => c.id as string)
  }

  // 3. Lifetime invoiced revenue from those clients (drafts/cancelled excluded).
  let revenue = 0
  if (acquiredClientIds.length > 0) {
    const { data: invoiceRows, error: invoicesErr } = await notDeleted(
      supabase
        .from('invoices')
        .select('total')
        .in('client_id', acquiredClientIds)
        .neq('status', 'draft')
        .neq('status', 'cancelled'),
    )
    if (invoicesErr) log.error({ err: invoicesErr.message }, 'roi_invoices_failed')
    revenue = sum((invoiceRows ?? []).map((r) => Number(r.total ?? 0)))
  }

  return computeMarketingRoi({
    spend,
    leads,
    totalLeads: periodLeads.length,
    closedLeads: closedLeads.length,
    closedPipelineValue,
    acquiredCustomers: acquiredClientIds.length,
    revenue,
    currency,
  })
}

// ── Attribution funnel by channel ────────────────────────────────────────────

export type LeadFunnelRow = {
  /** Normalised source label: utm_source takes precedence over lead.source. */
  source: string
  total: number
  qualified: number
  won: number
  /** won / total, null when total === 0. */
  conversionRate: number | null
  /** Sum of estimated_value for won leads (proxy for pipeline revenue). */
  pipelineValue: number
}

/**
 * Aggregates all leads created in [since, until] by acquisition channel.
 * Covers every source (landing, meta_lead_ads, cal.com, orgánico…), not just Meta.
 *
 * Designed for a dashboard where "since" and "until" are ISO date strings such
 * as "2025-01-01". Comparison against timestamptz columns uses Postgres implicit
 * coercion — acceptable ±1 day precision for analytics.
 */
export async function getLeadFunnelBySource(
  since: string,
  until: string,
): Promise<LeadFunnelRow[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('leads')
    .select('utm_source, source, status, estimated_value')
    .gte('created_at', since)
    .lte('created_at', `${until}T23:59:59.999Z`)
    .is('deleted_at', null)

  if (error || !data?.length) return []

  const map = new Map<
    string,
    { total: number; qualified: number; won: number; pipelineValue: number }
  >()

  const QUALIFIED_STATUSES = new Set([
    'contacted',
    'in_conversation',
    'qualifying',
    'quoted',
    'won',
  ])

  for (const row of data) {
    const rawKey =
      (row.utm_source as string | null)?.trim() ||
      (row.source as string | null)?.trim() ||
      'directo'
    const key = normalizeLeadSource(rawKey) ?? rawKey

    const bucket = map.get(key) ?? { total: 0, qualified: 0, won: 0, pipelineValue: 0 }
    bucket.total++
    if (QUALIFIED_STATUSES.has(row.status as string)) bucket.qualified++
    if (row.status === 'won') {
      bucket.won++
      bucket.pipelineValue += Number(row.estimated_value ?? 0)
    }
    map.set(key, bucket)
  }

  return Array.from(map.entries())
    .map(([source, s]) => ({
      source,
      total: s.total,
      qualified: s.qualified,
      won: s.won,
      pipelineValue: round2(s.pipelineValue),
      conversionRate: s.total > 0 ? s.won / s.total : null,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)
}
