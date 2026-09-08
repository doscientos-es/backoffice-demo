import { roundCurrency } from '@/lib/finance/helpers'
import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

import * as MetaAPI from './integrations/meta-marketing'
import {
  extractMetaCreativeDetails,
  extractMetaLeads,
  extractMetaTrafficMetrics,
} from './integrations/meta-marketing'

const log = scopedLogger('marketing-sync')

/** Extract a useful message from Error instances and Supabase's plain error objects. */
export function getMarketingSyncErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof err.message === 'string'
  ) {
    return err.message
  }
  return 'Error desconocido durante la sincronización'
}

/** Maps Meta's camelCase creative fields to the database's snake_case columns. */
export function mapMetaAdForStorage(ad: MetaAPI.MetaMarketingAd, updatedAt: string) {
  const creative = extractMetaCreativeDetails(ad)
  return {
    creative_id: creative.creativeId,
    destination_url: creative.destinationUrl,
    url_tags: creative.urlTags,
    call_to_action_type: creative.callToActionType,
    lead_form_id: creative.leadFormId,
    id: ad.id,
    adset_id: ad.adset_id,
    campaign_id: ad.campaign_id,
    name: ad.name,
    status: ad.status,
    preview_url: ad.creative?.thumbnail_url,
    updated_at: updatedAt,
    raw_payload: ad,
  }
}

/**
 * Full sync of Campaigns, Ad Sets and Ads from Meta.
 */
export async function syncMetaCatalog() {
  const supabase = createAdminClient()

  try {
    const [campaigns, adsets, ads] = await Promise.all([
      MetaAPI.getMetaCampaigns(),
      MetaAPI.getMetaAdSets(),
      MetaAPI.getMetaAds(),
    ])

    // `updated_at` lacks an UPDATE trigger so we set it explicitly on every
    // sync. This lets the dashboard derive "last sync" from max(updated_at).
    const now = new Date().toISOString()

    // Upsert Campaigns
    if (campaigns.length > 0) {
      const { error: cErr } = await supabase.from('marketing_campaigns').upsert(
        campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          buying_type: c.buying_type,
          start_time: c.start_time,
          stop_time: c.stop_time,
          updated_at: now,
          raw_payload: c,
        })),
      )
      if (cErr) throw cErr
    }

    // Upsert Ad Sets
    if (adsets.length > 0) {
      const { error: asErr } = await supabase.from('marketing_ad_sets').upsert(
        adsets.map((as) => ({
          id: as.id,
          campaign_id: as.campaign_id,
          name: as.name,
          status: as.status,
          billing_event: as.billing_event,
          optimization_goal: as.optimization_goal,
          daily_budget: as.daily_budget ? Number.parseFloat(as.daily_budget) / 100 : null,
          lifetime_budget: as.lifetime_budget ? Number.parseFloat(as.lifetime_budget) / 100 : null,
          updated_at: now,
          raw_payload: as,
        })),
      )
      if (asErr) throw asErr
    }

    // Upsert Ads
    if (ads.length > 0) {
      const { error: aErr } = await supabase
        .from('marketing_ads')
        .upsert(ads.map((ad) => mapMetaAdForStorage(ad, now)))
      if (aErr) throw aErr
    }

    return {
      ok: true,
      synced: { campaigns: campaigns.length, adsets: adsets.length, ads: ads.length },
    }
  } catch (err) {
    log.error({ err }, 'syncMetaCatalog failed')
    return { ok: false, error: getMarketingSyncErrorMessage(err) }
  }
}

/**
 * Sync daily insights for a given range.
 */
export async function syncMetaInsights(since: string, until: string) {
  const supabase = createAdminClient()

  try {
    const insights = await MetaAPI.getMetaInsights(since, until)
    if (insights.length === 0) return { ok: true, synced: 0 }

    const { error } = await supabase.from('marketing_insights').upsert(
      insights.map((i) => {
        const spend = Number.parseFloat(i.spend) || 0
        const clicks = Number.parseInt(i.clicks, 10) || 0
        const { totalLeads, costPerLead } = extractMetaLeads(i.actions, spend, clicks)
        const traffic = extractMetaTrafficMetrics(i)
        return {
          ad_id: i.ad_id,
          date_start: i.date_start,
          date_stop: i.date_stop,
          impressions: Number.parseInt(i.impressions, 10) || 0,
          reach: Number.parseInt(i.reach, 10) || 0,
          clicks,
          inline_link_clicks: traffic.inlineLinkClicks,
          outbound_clicks: traffic.outboundClicks,
          unique_outbound_clicks: traffic.uniqueOutboundClicks,
          landing_page_views: traffic.landingPageViews,
          spend,
          currency: i.account_currency ?? 'EUR',
          ctr: Number.parseFloat(i.ctr) || null,
          cpc: i.cpc ? Number.parseFloat(i.cpc) : null,
          cpp: i.cpp ? Number.parseFloat(i.cpp) : null,
          total_leads: totalLeads,
          cost_per_lead: costPerLead || null,
        }
      }),
      { onConflict: 'ad_id,date_start' },
    )

    if (error) throw error
    return { ok: true, synced: insights.length }
  } catch (err) {
    log.error({ err }, 'syncMetaInsights failed')
    return { ok: false, error: getMarketingSyncErrorMessage(err) }
  }
}

/**
 * Mirror Meta Ads spend into the finance module as monthly expenses so the
 * amount invested shows up in cash-flow, P&L and expense reports without any
 * manual bookkeeping.
 *
 * Spend from `marketing_insights` is aggregated per calendar month and written
 * as a single expense per month (vendor "Meta", category `meta_ads`), keyed by
 * `invoice_reference = meta-ads-YYYY-MM` so repeated syncs upsert rather than
 * duplicate. Each affected month is recomputed in full from the start of its
 * month — never just the requested window — so a partial boundary month (or a
 * still-accumulating current month) always reflects the correct total.
 *
 * Meta EU billing is reverse-charge, so the recorded amount is booked with 0%
 * tax (`subtotal = total = spend`); the user can adjust individual rows later.
 */
export async function syncMetaSpendToExpenses(since: string, until: string) {
  const supabase = createAdminClient()

  try {
    // Expand the lower bound to the first day of `since`'s month so each touched
    // month is aggregated in full, keeping the upsert idempotent regardless of
    // the window Meta was polled with.
    const monthFloor = `${since.slice(0, 7)}-01`

    const { data: rows, error: readErr } = await supabase
      .from('marketing_insights')
      .select('spend, currency, date_start, date_stop')
      .gte('date_start', monthFloor)
      .lte('date_start', until)
    if (readErr) throw readErr

    // Keep only true daily rows (date_start === date_stop) to avoid folding a
    // legacy period-aggregate row into a month, mirroring the dashboard queries.
    type MonthBucket = { spend: number; currency: string; maxDate: string }
    const byMonth = new Map<string, MonthBucket>()
    for (const r of rows ?? []) {
      if (!r.date_start || r.date_start !== r.date_stop) continue
      const key = r.date_start.slice(0, 7) // YYYY-MM
      const bucket = byMonth.get(key) ?? {
        spend: 0,
        currency: r.currency ?? 'EUR',
        maxDate: r.date_start,
      }
      bucket.spend += Number(r.spend ?? 0)
      if (r.date_start > bucket.maxDate) bucket.maxDate = r.date_start
      byMonth.set(key, bucket)
    }

    const months = Array.from(byMonth.entries())
      .map(([key, b]) => ({ key, ...b, spend: roundCurrency(b.spend) }))
      .filter((m) => m.spend > 0)
    if (months.length === 0) return { ok: true, synced: 0 }

    // Look up which months already have an auto-synced expense so we update in
    // place instead of inserting duplicates (no DB unique constraint on ref).
    const refs = months.map((m) => `meta-ads-${m.key}`)
    const { data: existing, error: existErr } = await supabase
      .from('expenses')
      .select('id, invoice_reference')
      .eq('category', 'meta_ads')
      .in('invoice_reference', refs)
      .is('deleted_at', null)
    if (existErr) throw existErr
    const idByRef = new Map(
      (existing ?? []).map((e) => [e.invoice_reference as string, e.id as string]),
    )

    const now = new Date().toISOString()
    const toInsert: Record<string, unknown>[] = []

    for (const m of months) {
      const ref = `meta-ads-${m.key}`
      const row = {
        vendor: 'Meta',
        description: `Inversión en anuncios de Meta (${m.key})`,
        category: 'meta_ads' as const,
        status: 'paid' as const,
        recurrence: 'none' as const,
        expense_date: m.maxDate,
        currency: m.currency || 'EUR',
        subtotal: m.spend,
        tax_rate: 0,
        tax_amount: 0,
        total: m.spend,
        invoice_reference: ref,
        updated_at: now,
      }

      const existingId = idByRef.get(ref)
      if (existingId) {
        const { error: updErr } = await supabase.from('expenses').update(row).eq('id', existingId)
        if (updErr) throw updErr
      } else {
        toInsert.push(row)
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('expenses').insert(toInsert)
      if (insErr) throw insErr
    }

    return { ok: true, synced: months.length }
  } catch (err) {
    log.error({ err }, 'syncMetaSpendToExpenses failed')
    return { ok: false, error: getMarketingSyncErrorMessage(err) }
  }
}
