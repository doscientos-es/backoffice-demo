import type { MarketingView } from './range'

export type MarketingOverview = {
  ads: ActiveAdRow[]
  totalSpent: number
  totalLeads: number
  totalImpressions: number
  totalClicks: number
  totalOutboundClicks: number
  totalLandingPageViews: number
  avgCpl: number
  avgCtr: number
  avgCpc: number
  currency: string
  lastSyncAt: string | null
}

export type ActiveAdRow = {
  id: string
  name: string
  status: string
  preview_url: string | null
  destinationUrl: string | null
  callToActionType: string | null
  leadFormId: string | null
  campaignName: string
  spend: number
  impressions: number
  clicks: number
  outboundClicks: number
  landingPageViews: number
  leads: number
  ctr: number
  cpc: number
  cpl: number
  currency: string
}

/** Series key used for the aggregated "Otros" bucket in the breakdown chart. */
export const INSIGHTS_OTHERS_KEY = '__otros__'

/** A single series (one ad or one campaign) in the daily breakdown chart. */
export type InsightsSeriesMeta = { key: string; label: string }

/**
 * One day of the breakdown chart. `total` and `leads` are account-wide for that
 * day; every remaining numeric key is the per-series spend, keyed by its series
 * `key`. The string index signature is what lets Recharts read each series by
 * its dynamic `dataKey`.
 */
export type InsightsBreakdownPoint = {
  date: string
  total: number
  leads: number
  [seriesKey: string]: string | number
}

/**
 * Daily spend broken down by ad or campaign, ready to feed a stacked bar chart.
 * `series` lists the top spenders in stack order, plus an aggregated "Otros"
 * bucket when there are more entities than the cap.
 */
export type InsightsBreakdown = {
  dimension: MarketingView
  points: InsightsBreakdownPoint[]
  series: InsightsSeriesMeta[]
}

export interface RawInsightRow {
  spend: number | null
  impressions: number | null
  clicks: number | null
  inline_link_clicks?: number | null
  outbound_clicks?: number | null
  unique_outbound_clicks?: number | null
  landing_page_views?: number | null
  ctr: number | null
  cpc: number | null
  total_leads: number | null
  cost_per_lead: number | null
  currency: string | null
  date_start: string | null
  date_stop: string | null
}

type RawCampaign = {
  id: string | null
  name: string | null
  status: string | null
  objective: string | null
}

export interface RawAdRow {
  id: string
  name: string
  status: string | null
  preview_url: string | null
  destination_url?: string | null
  call_to_action_type?: string | null
  lead_form_id?: string | null
  updated_at: string | null
  campaign_id: string | null
  marketing_campaigns: RawCampaign | RawCampaign[] | null
  marketing_insights: RawInsightRow[] | null
}

export type CampaignRow = {
  id: string
  name: string
  status: string
  objective: string | null
  adCount: number
  activeAdCount: number
  spend: number
  impressions: number
  clicks: number
  outboundClicks: number
  landingPageViews: number
  leads: number
  ctr: number
  cpc: number
  cpl: number
  currency: string
}

export type CampaignsOverview = {
  campaigns: CampaignRow[]
  totalSpent: number
  totalLeads: number
  totalImpressions: number
  totalClicks: number
  totalOutboundClicks: number
  totalLandingPageViews: number
  avgCpl: number
  avgCtr: number
  avgCpc: number
  currency: string
  lastSyncAt: string | null
}
