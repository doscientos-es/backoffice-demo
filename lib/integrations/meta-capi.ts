import crypto from 'node:crypto'

import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'

/**
 * Meta Conversions API (server-side events).
 *
 * Sends conversion events to Meta so the ad algorithm can optimise for
 * actual business outcomes (client acquired, invoice paid) instead of just
 * form fills. Errors never throw — callers should invoke fire-and-forget.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

const log = scopedLogger('meta-capi')
const CAPI_VERSION = 'v26.0'
const META_INSTANT_FORM_SOURCE = 'Anuncios Meta'

function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

function normalizePhone(phone: string): string {
  // Keep only digits; Meta expects E.164 without leading +
  return phone.replace(/\D/g, '')
}

export type CapiConversionInput = {
  /**
   * `Lead`    — fired when lead is converted to client (primary signal).
   * `Purchase` — fired when an invoice is marked paid (highest-value signal).
   */
  eventName: 'Lead' | 'Purchase'
  /**
   * Deduplication key. Use `${eventName}-${leadId}` for backend-only events.
   * For events that also fire client-side via the Pixel (e.g. a form submit
   * tracked by both `fbq('track','Lead',...)` and this server call), reuse
   * the same session `event_id` the browser sent so Meta merges the two into
   * a single event instead of double-counting.
   */
  eventId: string
  email?: string | null
  phone?: string | null
  /**
   * Meta-generated Lead Ads identifier. Keep it as a string: its 15–17 digits
   * can exceed JavaScript's safe integer range.
   */
  metaLeadId?: string | null
  /** Estimated deal value in EUR for bid optimization. */
  value?: number | null
  currency?: string
  /**
   * Where the event originated. Defaults to `"crm"` for internal backoffice
   * actions (e.g. manually converting a lead to a client). Use `"website"`
   * for events captured from a public form submission — pair it with
   * `eventSourceUrl`/`clientIpAddress`/`clientUserAgent` for better match
   * quality and to dedup correctly against the browser Pixel event.
   * Use `"system_generated"` for backend-only funnel-stage transitions with
   * no direct user interaction (e.g. a CRM status change), per Meta's CRM
   * Integration guidance.
   */
  actionSource?: 'website' | 'crm' | 'system_generated'
  /** Full URL of the page where the event happened. Expected by Meta for `"website"` events. */
  eventSourceUrl?: string | null
  /** Raw request IP — improves Advanced Matching. */
  clientIpAddress?: string | null
  /** Raw `User-Agent` header — improves Advanced Matching. */
  clientUserAgent?: string | null
  /** Meta browser identifiers, collected only after marketing consent. */
  fbc?: string | null
  fbp?: string | null
  /**
   * Extra fields merged into Meta's `custom_data` object (e.g.
   * `event_source: "crm"`, `lead_event_source`, `lead_status`). Combined
   * with `value`/`currency` when both are provided.
   */
  custom_data?: Record<string, string | number | boolean | null | undefined>
}

export type QualifiedLeadStageInput = {
  /** Internal CRM UUID, used only to make a stage event idempotent. */
  leadId: string
  status: string
  email?: string | null
  phone?: string | null
  value?: number | null
  /** Stored provider identifier from leads.external_id. */
  externalId?: string | null
  /** Stored provider namespace from leads.external_source. */
  externalSource?: string | null
}

function metaInstantFormLeadId(input: QualifiedLeadStageInput): string | undefined {
  const id = input.externalId?.trim()
  return input.externalSource === META_INSTANT_FORM_SOURCE && /^\d{15,17}$/.test(id ?? '')
    ? id
    : undefined
}

/**
 * Sends the CRM-stage format required by Meta Qualified Leads. The provider
 * lead ID is attached only for genuine Meta instant-form leads; other CRM
 * sources still benefit from hashed contact matching without sending an
 * unrelated external identifier as `lead_id`.
 */
export function pushMetaQualifiedLeadStage(input: QualifiedLeadStageInput): Promise<void> {
  return pushMetaConversion({
    eventName: 'Lead',
    eventId: `lead-${input.leadId}-${input.status}`,
    email: input.email,
    phone: input.phone,
    metaLeadId: metaInstantFormLeadId(input),
    value: input.value,
    actionSource: 'system_generated',
    custom_data: {
      event_source: 'crm',
      lead_event_source: 'doscientos-backoffice',
      lead_status: input.status,
    },
  })
}

/**
 * Push one conversion event to Meta CAPI.
 * No-ops silently when META_PIXEL_ID or META_CAPI_ACCESS_TOKEN is not set.
 */
export async function pushMetaConversion(input: CapiConversionInput): Promise<void> {
  const { META_PIXEL_ID, META_CAPI_ACCESS_TOKEN } = serverEnv()

  if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) {
    log.debug('meta capi not configured, skipping')
    return
  }

  // Hashed user data — Meta requires lowercase, trimmed, SHA-256.
  const userData: Record<string, string | string[]> = {}
  if (input.email) {
    userData.em = [sha256hex(input.email)]
  }
  if (input.phone) {
    const normalized = normalizePhone(input.phone)
    if (normalized) userData.ph = [sha256hex(normalized)]
  }
  if (input.metaLeadId) userData.lead_id = input.metaLeadId

  // Meta requires at least one matching field. The Meta-generated lead ID is
  // the strongest Qualified Leads signal, and is valid even without em/ph.
  if (!userData.em && !userData.ph && !userData.lead_id) {
    log.debug({ eventId: input.eventId }, 'meta capi: no user data available, skipping')
    return
  }

  // Not hashed — Meta uses these as-is for Advanced Matching.
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent
  if (input.fbc) userData.fbc = input.fbc
  if (input.fbp) userData.fbp = input.fbp

  // Meta uses currency for ROAS calculation even when a Lead does not yet
  // have an estimated value. The CRM is EUR-denominated, so always send its
  // ISO 4217 code and only add `value` when one is known.
  const customData = {
    ...(input.value != null ? { value: input.value } : {}),
    ...input.custom_data,
    currency: input.currency ?? 'EUR',
  }

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: input.actionSource ?? 'crm',
        event_source_url: input.eventSourceUrl ?? undefined,
        user_data: userData,
        custom_data: customData,
      },
    ],
  }

  const url = `https://graph.facebook.com/${CAPI_VERSION}/${META_PIXEL_ID}/events?access_token=${META_CAPI_ACCESS_TOKEN}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>

    if (!res.ok) {
      log.warn({ status: res.status, error: body.error }, 'meta_capi_error')
      return
    }

    log.info({ events_received: body.events_received, eventId: input.eventId }, 'meta_capi_sent')
  } catch (e) {
    log.warn({ err: e }, 'meta_capi_fetch_failed')
  }
}
