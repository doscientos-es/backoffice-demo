import { after, type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import {
  type CalWebhookPayload,
  mapCalToLeadIntake,
  verifyCalSignature,
} from '@/lib/integrations/cal'
import { recordConversionEvent } from '@/lib/integrations/conversion-events'
import { ingestLead } from '@/lib/integrations/lead-intake'
import { pushMetaQualifiedLeadStage } from '@/lib/integrations/meta-capi'
import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('cal-webhook')

export async function POST(request: NextRequest) {
  const env = serverEnv()

  if (!env.CAL_WEBHOOK_SECRET) {
    log.warn('CAL_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
  }

  const raw = await request.text()
  const signature = request.headers.get('x-cal-signature-256')

  if (!verifyCalSignature(env.CAL_WEBHOOK_SECRET, raw, signature)) {
    log.warn('invalid cal signature')
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: CalWebhookPayload
  try {
    payload = JSON.parse(raw) as CalWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { triggerEvent } = payload
  const intake = mapCalToLeadIntake(payload)
  const result = await ingestLead(intake)

  if (!result.ok) {
    log.error({ error: result.error, bookingId: payload.payload.uid }, 'ingestLead failed')
    return NextResponse.json({ ok: false, error: result.error, partial: true })
  }

  const supabase = createAdminClient()
  const leadId = result.leadId

  // Update lead status if it's a booking event
  if (triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'BOOKING_RESCHEDULED') {
    const { data: updated } = await supabase
      .from('leads')
      .update({ status: 'in_conversation', updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('status', 'new') // Booking a call is an inbound reply: the conversation is alive
      .select('id')
      .maybeSingle()

    // Fire-and-forget: notify Meta CAPI of the funnel stage transition.
    if (updated) {
      after(async () => {
        try {
          const { data: lead } = await createAdminClient()
            .from('leads')
            .select('email, phone, external_id, external_source')
            .eq('id', leadId)
            .maybeSingle()
          if (lead) {
            await pushMetaQualifiedLeadStage({
              leadId,
              status: 'in_conversation',
              email: lead.email as string | null,
              phone: lead.phone as string | null,
              externalId: lead.external_id as string | null,
              externalSource: lead.external_source as string | null,
            })
          }
        } catch (e) {
          log.warn({ err: e, leadId }, 'meta_capi_status_failed')
        }
      })
    }

    if (triggerEvent === 'BOOKING_CREATED') {
      await recordConversionEvent({
        event_id: intake.context?.eventId ?? null,
        visitor_id: intake.context?.visitorId ?? null,
        lead_id: leadId,
        event_name: 'calendar_booking_completed',
        conversion_step: intake.context?.conversionStep ?? null,
        landing_path: intake.context?.landingPath ?? null,
        landing_ref: intake.context?.landingRef ?? null,
        referrer: intake.context?.referrer ?? null,
        utm_source: intake.utm?.source ?? null,
        utm_medium: intake.utm?.medium ?? null,
        utm_campaign: intake.utm?.campaign ?? null,
        utm_term: intake.utm?.term ?? null,
        utm_content: intake.utm?.content ?? null,
        payload: { provider: 'cal.com', booking_id: payload.payload.uid },
      })
    }
  }

  // Log interaction
  await supabase.from('lead_interactions').insert({
    lead_id: leadId,
    type: 'note',
    subject: `Cal.com: ${triggerEvent}`,
    body: `Booking: ${payload.payload.title}\nTime: ${payload.payload.startTime} - ${payload.payload.endTime}\nUID: ${payload.payload.uid}`,
    payload: payload as unknown as Record<string, unknown>,
  })

  return NextResponse.json({
    ok: true,
    leadId,
    duplicate: result.duplicate,
  })
}
