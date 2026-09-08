import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'

const log = scopedLogger('meta-marketing')

// ---------------- Types ----------------

export interface MetaMarketingCampaign {
  id: string
  name: string
  status: string
  objective: string
  buying_type: string
  start_time?: string
  stop_time?: string
}

export interface MetaMarketingAdSet {
  id: string
  campaign_id: string
  name: string
  status: string
  billing_event: string
  optimization_goal: string
  daily_budget?: string
  lifetime_budget?: string
}

export interface MetaMarketingAd {
  id: string
  adset_id: string
  campaign_id: string
  name: string
  status: string
  creative?: {
    id: string
    thumbnail_url?: string
    call_to_action_type?: string
    url_tags?: string
    object_url?: string
    object_story_spec?: {
      link_data?: {
        link?: string
        call_to_action?: { type?: string; value?: { lead_gen_form_id?: string } }
      }
      template_data?: {
        link?: string
        call_to_action?: { type?: string; value?: { lead_gen_form_id?: string } }
      }
    }
  }
}

export interface MetaActionStat {
  action_type: string
  value: string
}

export interface MetaMarketingInsight {
  ad_id?: string
  campaign_id?: string
  campaign_name?: string
  date_start: string
  date_stop: string
  impressions: string
  reach: string
  clicks: string
  spend: string
  ctr: string
  cpc?: string
  cpp?: string
  inline_link_clicks?: string
  outbound_clicks?: MetaActionStat[]
  unique_outbound_clicks?: MetaActionStat[]
  account_currency?: string
  actions?: MetaActionStat[]
  cost_per_action_type?: MetaActionStat[]
}

/** Meta's current grouped form-fill metric, preferred over legacy `lead`. */
const GROUPED_LEAD_ACTION_TYPE = 'onsite_conversion.lead_grouped'
/** Backwards-compatible metric for campaigns that do not report the grouped action. */
const LEGACY_LEAD_ACTION_TYPE = 'lead'
const LANDING_PAGE_VIEW_ACTION_TYPES = new Set(['landing_page_view'])
const OUTBOUND_CLICK_ACTION_TYPES = new Set(['outbound_click'])

function sumActionValues(
  actions: MetaActionStat[] | undefined,
  actionTypes: ReadonlySet<string>,
): number {
  return (actions ?? [])
    .filter((action) => actionTypes.has(action.action_type))
    .reduce((sum, action) => sum + (Number.parseFloat(action.value) || 0), 0)
}

function actionValue(actions: MetaActionStat[] | undefined, actionType: string): number | undefined {
  const action = actions?.find((candidate) => candidate.action_type === actionType)
  return action ? Number.parseFloat(action.value) || 0 : undefined
}

/**
 * Extracts lead count and computed cost-per-lead from a Meta insight row.
 * Prefers Meta's grouped form-fill metric. The legacy `lead` action is only a
 * fallback: Meta can return both for one conversion, so adding them inflates
 * the reported count and understates CPL.
 */
export function extractMetaLeads(
  actions: MetaActionStat[] | undefined,
  spend: number,
  maxPlausibleLeads = Number.POSITIVE_INFINITY,
): { totalLeads: number; costPerLead: number } {
  const reportedLeads =
    actionValue(actions, GROUPED_LEAD_ACTION_TYPE) ?? actionValue(actions, LEGACY_LEAD_ACTION_TYPE) ?? 0
  // A single lead conversion requires a prior ad click. Meta may occasionally
  // return an aggregated legacy action for an individual daily ad insight; do
  // not persist that impossible count as a daily lead total.
  const totalLeads = reportedLeads <= maxPlausibleLeads ? reportedLeads : 0

  return {
    totalLeads,
    costPerLead: totalLeads > 0 ? spend / totalLeads : 0,
  }
}

/** Metrics that describe the path from an ad click to an actual page view. */
export function extractMetaTrafficMetrics(insight: MetaMarketingInsight): {
  inlineLinkClicks: number
  outboundClicks: number
  uniqueOutboundClicks: number
  landingPageViews: number
} {
  return {
    inlineLinkClicks: Number.parseInt(insight.inline_link_clicks ?? '', 10) || 0,
    outboundClicks: sumActionValues(insight.outbound_clicks, OUTBOUND_CLICK_ACTION_TYPES),
    uniqueOutboundClicks: sumActionValues(
      insight.unique_outbound_clicks,
      OUTBOUND_CLICK_ACTION_TYPES,
    ),
    landingPageViews: sumActionValues(insight.actions, LANDING_PAGE_VIEW_ACTION_TYPES),
  }
}

/** Extract stable, user-visible creative details without depending on raw JSON. */
export function extractMetaCreativeDetails(ad: MetaMarketingAd): {
  creativeId: string | null
  destinationUrl: string | null
  urlTags: string | null
  callToActionType: string | null
  leadFormId: string | null
} {
  const creative = ad.creative
  const linkData =
    creative?.object_story_spec?.link_data ?? creative?.object_story_spec?.template_data
  return {
    creativeId: creative?.id ?? null,
    destinationUrl: creative?.object_url ?? linkData?.link ?? null,
    urlTags: creative?.url_tags ?? null,
    callToActionType: creative?.call_to_action_type ?? linkData?.call_to_action?.type ?? null,
    leadFormId: linkData?.call_to_action?.value?.lead_gen_form_id ?? null,
  }
}

// ---------------- API Calls ----------------

const REQUEST_TIMEOUT_MS = 25_000
const MAX_ATTEMPTS = 4
const PAGE_LIMIT = 100
const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENETUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
])

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return true
  // undici exposes the underlying cause with a Node `code`
  const cause = (err as { cause?: unknown }).cause
  const code =
    (cause && typeof cause === 'object' && 'code' in cause
      ? (cause as { code?: unknown }).code
      : undefined) ?? (err as { code?: unknown }).code
  return typeof code === 'string' && TRANSIENT_NET_CODES.has(code)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250)
      log.warn({ status: res.status, attempt, delay }, 'Meta API transient HTTP, retrying')
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }
    return res
  } catch (err) {
    if (isTransientNetworkError(err) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250)
      log.warn({ err, attempt, delay }, 'Meta API transient network error, retrying')
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }
    throw err
  }
}

async function fetchMetaMarketing<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const env = serverEnv()
  const token = env.META_USER_ACCESS_TOKEN || env.META_PAGE_ACCESS_TOKEN

  if (!token) {
    throw new Error('Meta Access Token (User or Page) not configured')
  }

  const firstUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${path}`)
  firstUrl.searchParams.set('access_token', token)
  firstUrl.searchParams.set('limit', String(PAGE_LIMIT))
  for (const [key, value] of Object.entries(params)) {
    firstUrl.searchParams.set(key, value)
  }

  const results: T[] = []
  let nextUrl: string | null = firstUrl.toString()
  let pages = 0

  while (nextUrl) {
    const res = await fetchWithRetry(nextUrl)
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      throw new Error(`Meta API Error ${res.status}: ${errorBody.slice(0, 500)}`)
    }
    const data = (await res.json()) as { data?: T[]; paging?: { next?: string } }
    if (data.data?.length) results.push(...data.data)
    nextUrl = data.paging?.next ?? null
    pages++
  }

  log.debug({ path, pages, count: results.length }, 'Meta API fetch complete')
  return results
}

export async function getMetaCampaigns(): Promise<MetaMarketingCampaign[]> {
  const env = serverEnv()
  if (!env.META_AD_ACCOUNT_ID) throw new Error('META_AD_ACCOUNT_ID not configured')

  return fetchMetaMarketing<MetaMarketingCampaign>(`${env.META_AD_ACCOUNT_ID}/campaigns`, {
    fields: 'id,name,status,objective,buying_type,start_time,stop_time',
  })
}

export async function getMetaAdSets(): Promise<MetaMarketingAdSet[]> {
  const env = serverEnv()
  if (!env.META_AD_ACCOUNT_ID) throw new Error('META_AD_ACCOUNT_ID not configured')

  return fetchMetaMarketing<MetaMarketingAdSet>(`${env.META_AD_ACCOUNT_ID}/adsets`, {
    fields:
      'id,campaign_id,name,status,billing_event,optimization_goal,daily_budget,lifetime_budget',
  })
}

export async function getMetaAds(): Promise<MetaMarketingAd[]> {
  const env = serverEnv()
  if (!env.META_AD_ACCOUNT_ID) throw new Error('META_AD_ACCOUNT_ID not configured')

  return fetchMetaMarketing<MetaMarketingAd>(`${env.META_AD_ACCOUNT_ID}/ads`, {
    fields:
      'id,adset_id,campaign_id,name,status,creative{id,thumbnail_url,call_to_action_type,url_tags,object_url,object_story_spec}',
  })
}

/**
 * Ad-level insights for a date range, broken down per day. Includes
 * Meta-attributed lead actions so we can compute CPL without depending on UTM
 * matching.
 *
 * `time_increment: 1` is required: without it Meta returns a single aggregated
 * row per ad (`date_start = since`, `date_stop = until`), which collides with the
 * `marketing_insights (ad_id, date_start)` daily model and makes range filtering
 * miss data and overlapping syncs double-count. With it, each row is a single
 * day (`date_start === date_stop`).
 */
export async function getMetaInsights(
  since: string,
  until: string,
): Promise<MetaMarketingInsight[]> {
  const env = serverEnv()
  if (!env.META_AD_ACCOUNT_ID) throw new Error('META_AD_ACCOUNT_ID not configured')

  return fetchMetaMarketing<MetaMarketingInsight>(`${env.META_AD_ACCOUNT_ID}/insights`, {
    level: 'ad',
    fields:
      'ad_id,date_start,date_stop,impressions,reach,clicks,inline_link_clicks,outbound_clicks,unique_outbound_clicks,spend,ctr,cpc,cpp,account_currency,actions,cost_per_action_type',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
  })
}

/**
 * Returns the Meta-hosted preview iframe HTML for a single ad in a given
 * placement format. Body looks like `<iframe src="https://..."></iframe>`.
 */
export type MetaAdPreviewFormat =
  | 'DESKTOP_FEED_STANDARD'
  | 'MOBILE_FEED_STANDARD'
  | 'INSTAGRAM_STANDARD'
  | 'FACEBOOK_STORY_MOBILE'
  | 'INSTAGRAM_STORY'

export async function getMetaAdPreview(
  adId: string,
  format: MetaAdPreviewFormat = 'DESKTOP_FEED_STANDARD',
): Promise<string | null> {
  const env = serverEnv()
  const token = env.META_USER_ACCESS_TOKEN || env.META_PAGE_ACCESS_TOKEN
  if (!token) throw new Error('Meta Access Token (User or Page) not configured')

  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${adId}/previews`)
  url.searchParams.set('access_token', token)
  url.searchParams.set('ad_format', format)

  const res = await fetchWithRetry(url.toString())
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    throw new Error(`Meta API Error ${res.status}: ${errorBody.slice(0, 300)}`)
  }
  const data = (await res.json()) as { data?: Array<{ body: string }> }
  return data.data?.[0]?.body ?? null
}

/**
 * Campaign-level insights for active campaigns, using a Meta `date_preset`
 * (e.g. `this_month`, `last_30d`, `lifetime`). Used by the dashboard to show
 * aggregated KPIs per campaign with Meta-attributed leads.
 */
export async function getMetaCampaignInsights(
  datePreset:
    | 'today'
    | 'yesterday'
    | 'this_month'
    | 'last_month'
    | 'last_30d'
    | 'lifetime' = 'this_month',
): Promise<MetaMarketingInsight[]> {
  const env = serverEnv()
  if (!env.META_AD_ACCOUNT_ID) throw new Error('META_AD_ACCOUNT_ID not configured')

  return fetchMetaMarketing<MetaMarketingInsight>(`${env.META_AD_ACCOUNT_ID}/insights`, {
    level: 'campaign',
    fields:
      'campaign_id,campaign_name,date_start,date_stop,impressions,reach,clicks,spend,ctr,cpc,account_currency,actions,cost_per_action_type',
    date_preset: datePreset,
    filtering: JSON.stringify([
      { field: 'campaign.delivery_info', operator: 'IN', value: ['active'] },
    ]),
  })
}
