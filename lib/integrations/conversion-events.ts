import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('conversion-events')

export const CONVERSION_EVENT_NAMES = [
  'page_view',
  'cta_click',
  'calculator_used',
  'form_view',
  'form_started',
  'form_field_focus',
  'form_step_1_completed',
  'form_step_2_viewed',
  'form_submit_attempted',
  'form_validation_failed',
  'calendar_viewed',
  'calendar_booking_clicked',
  'calendar_booking_completed',
  'whatsapp_click',
  'lead_created',
  'diagnostic_started',
  'diagnostic_step_completed',
  'diagnostic_completed',
  'diagnostic_report_sent',
  'diagnostic_report_opened',
] as const

/**
 * Eventos que la landing puede registrar por su cuenta desde el navegador
 * (POST /api/public/track-event). Deja fuera los que solo debe escribir el
 * servidor — lead_created, whatsapp_click y el diagnóstico completado — para
 * que nadie pueda inventarse conversiones desde la consola del navegador.
 */
export const PUBLIC_TRACKABLE_EVENT_NAMES = [
  'page_view',
  'cta_click',
  'calculator_used',
  'form_view',
  'form_started',
  'form_field_focus',
  'form_step_1_completed',
  'form_step_2_viewed',
  'form_submit_attempted',
  'form_validation_failed',
  'calendar_viewed',
  'calendar_booking_clicked',
  'diagnostic_started',
  'diagnostic_step_completed',
] as const

export const ConversionEventInput = z.object({
  event_id: z.string().trim().max(120).optional().nullable(),
  visitor_id: z.string().trim().max(120).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  event_name: z.enum(CONVERSION_EVENT_NAMES),
  conversion_step: z.string().trim().max(120).optional().nullable(),
  landing_path: z.string().trim().max(500).optional().nullable(),
  landing_ref: z.string().trim().max(200).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  utm_source: z.string().trim().max(200).optional().nullable(),
  utm_medium: z.string().trim().max(200).optional().nullable(),
  utm_campaign: z.string().trim().max(200).optional().nullable(),
  utm_term: z.string().trim().max(200).optional().nullable(),
  utm_content: z.string().trim().max(200).optional().nullable(),
  payload: z.record(z.unknown()).optional().nullable(),
})

export type ConversionEventInputType = z.infer<typeof ConversionEventInput>

/** Lo que acepta el endpoint público: sin lead_id (lo decide el servidor). */
export const PublicTrackEventInput = ConversionEventInput.omit({ lead_id: true }).extend({
  event_name: z.enum(PUBLIC_TRACKABLE_EVENT_NAMES),
})

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Crawlers/scanners that hit public tracking links (e.g. the WhatsApp footer
 * CTA gets recrawled by every SEO/social bot that indexes the landing).
 * A missing User-Agent is also treated as a bot: real browsers always send
 * one, so its absence means a raw HTTP client rather than a person clicking.
 */
const BOT_USER_AGENT_RE =
  /bot|crawl|spider|slurp|mediapartners|externalhit|meta-externalads|preview|headless|phantom|selenium|puppeteer|playwright|python-requests|python-urllib|curl\/|wget|go-http-client|okhttp|libwww-perl|node-fetch|axios\/|scrapy|ahrefs|semrush|mj12bot|dotbot|seranking|yandex|bingbot|googlebot|duckduckbot|baiduspider|sogou|exabot|petalbot|dataforseo|barkrowler|linkedinbot|redditbot|pinterest|slackbot|vkshare|w3c_validator|lighthouse|gtmetrix|pingdom|uptimerobot|site24x7|spillbot|gptbot|ccbot|bytespider|amazonbot|applebot/i

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return true
  return BOT_USER_AGENT_RE.test(userAgent)
}

export async function recordConversionEvent(
  input: ConversionEventInputType,
  ctx: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const payload = {
    event_id: input.event_id || null,
    visitor_id: input.visitor_id || null,
    lead_id: input.lead_id || null,
    event_name: input.event_name,
    conversion_step: input.conversion_step || null,
    landing_path: input.landing_path || null,
    landing_ref: input.landing_ref || null,
    referrer: input.referrer || null,
    utm_source: input.utm_source || null,
    utm_medium: input.utm_medium || null,
    utm_campaign: input.utm_campaign || null,
    utm_term: input.utm_term || null,
    utm_content: input.utm_content || null,
    ip: ctx.ip ?? null,
    user_agent: ctx.userAgent ?? null,
    payload: input.payload ?? null,
  }

  const { error } = await createAdminClient().from('conversion_events').insert(payload)
  if (error) {
    log.warn({ err: error, eventName: input.event_name }, 'conversion event insert failed')
  }
}

export async function linkConversionEventsToLead(input: {
  leadId: string
  visitorId?: string | null
  eventId?: string | null
}): Promise<void> {
  const supabase = createAdminClient()
  let linkedByEventId = false

  if (input.eventId) {
    const { data, error } = await supabase
      .from('conversion_events')
      .update({ lead_id: input.leadId })
      .eq('event_id', input.eventId)
      .in('event_name', ['whatsapp_click', 'calendar_booking_clicked'])
      .is('lead_id', null)
      .select('id')
    if (error) {
      log.warn({ err: error, leadId: input.leadId }, 'conversion event link failed')
    } else {
      linkedByEventId = (data?.length ?? 0) > 0
    }
  }

  // visitor_id is only a fallback for a tracked conversion from another browser
  // session. Refuse ambiguous matches so one visitor cannot attach an entire
  // browsing history to a later lead.
  if (linkedByEventId || !input.visitorId) return

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: candidates, error: lookupError } = await supabase
    .from('conversion_events')
    .select('id')
    .eq('visitor_id', input.visitorId)
    .in('event_name', ['whatsapp_click', 'calendar_booking_clicked'])
    .is('lead_id', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(2)

  if (lookupError) {
    log.warn({ err: lookupError, leadId: input.leadId }, 'conversion event lookup failed')
    return
  }
  const candidate = candidates?.length === 1 ? candidates[0] : null
  if (!candidate) return

  const { error } = await supabase
    .from('conversion_events')
    .update({ lead_id: input.leadId })
    .eq('id', candidate.id)
    .is('lead_id', null)
  if (error) {
    log.warn({ err: error, leadId: input.leadId }, 'fallback conversion event link failed')
  }
}
