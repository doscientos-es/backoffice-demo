import { createHmac, timingSafeEqual } from 'node:crypto'

import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

const RESEND_TO_INTERACTION: Record<string, string> = {
  'email.sent': 'email_sent',
  'email.scheduled': 'email_scheduled',
  'email.delivered': 'email_delivered',
  'email.delivery_delayed': 'email_delivery_delayed',
  'email.failed': 'email_failed',
  'email.opened': 'email_opened',
  'email.clicked': 'email_clicked',
  'email.bounced': 'email_bounced',
  'email.complained': 'email_complained',
  'email.suppressed': 'email_suppressed',
  'email.received': 'email_received',
}

const RESEND_EVENT_SUBJECT: Record<string, string> = {
  'email.sent': 'Resend confirmó el envío',
  'email.scheduled': 'Email programado en Resend',
  'email.delivered': 'Email entregado por Resend',
  'email.delivery_delayed': 'Entrega de email retrasada',
  'email.failed': 'Error al enviar el email',
  'email.opened': 'Email abierto',
  'email.clicked': 'Enlace del email pulsado',
  'email.bounced': 'Email rebotado',
  'email.complained': 'Email marcado como spam',
  'email.suppressed': 'Email suprimido por Resend',
  'email.received': 'Email recibido mediante Resend',
}

type ResendWebhookPayload = {
  type?: string
  data?: {
    email_id?: string
    from?: string
    subject?: string
    to?: string | string[]
    [key: string]: unknown
  }
}

/** Maximum age (seconds) accepted for a Svix timestamp to prevent replay attacks. */
const SVIX_TIMESTAMP_TOLERANCE_S = 300

export const runtime = 'nodejs'

function extractEmailAddress(value: string | undefined): string | null {
  if (!value) return null
  const address = (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : null
}

function eventSubject(type: string, subject: string | undefined): string {
  const label = RESEND_EVENT_SUBJECT[type] ?? type
  return subject?.trim() ? `${label} · ${subject.trim()}` : label
}

/**
 * Verifies a Resend webhook using the Svix signing scheme.
 *
 * Message = `${svix-id}.${svix-timestamp}.${rawBody}`
 * Secret  = base64-decoded `whsec_…` value from Resend dashboard.
 * Header  = `svix-signature: v1,<base64> [v1,<base64> …]`
 */
function verifySvixSignature(
  secret: string,
  body: string,
  msgId: string | null,
  msgTimestamp: string | null,
  sigHeader: string | null,
): boolean {
  if (!msgId || !msgTimestamp || !sigHeader) return false

  // Replay protection: reject messages older than tolerance window.
  const ts = Number(msgTimestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SVIX_TIMESTAMP_TOLERANCE_S) {
    return false
  }

  // Decode the whsec_<base64> secret used by Resend.
  const rawKey = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')

  const toSign = `${msgId}.${msgTimestamp}.${body}`
  const expected = createHmac('sha256', rawKey).update(toSign).digest('base64')

  // The header may carry multiple space-separated `v1,<base64>` signatures.
  return sigHeader
    .split(' ')
    .filter((s) => s.startsWith('v1,'))
    .some((sig) => {
      const a = Buffer.from(expected, 'base64')
      const b = Buffer.from(sig.slice(3), 'base64')
      return a.length === b.length && timingSafeEqual(a, b)
    })
}

export async function POST(request: NextRequest) {
  const env = serverEnv()
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const raw = await request.text()
  if (
    !verifySvixSignature(
      env.RESEND_WEBHOOK_SECRET,
      raw,
      request.headers.get('svix-id'),
      request.headers.get('svix-timestamp'),
      request.headers.get('svix-signature'),
    )
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(raw) as ResendWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = payload.type
  const emailId = payload.data?.email_id
  const webhookId = request.headers.get('svix-id')
  if (!type || !emailId || !webhookId) return NextResponse.json({ ok: true })

  const interactionType = RESEND_TO_INTERACTION[type]
  if (!interactionType) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()
  const { data: prior } = await supabase
    .from('lead_interactions')
    .select('lead_id, client_id')
    .eq('resend_email_id', emailId)
    .limit(1)
    .maybeSingle()

  let leadId = prior?.lead_id ?? null
  const clientId = prior?.client_id ?? null

  if (!leadId && !clientId && type === 'email.received') {
    const sender = extractEmailAddress(payload.data?.from)
    if (sender) {
      const { data: matchedLead, error: leadError } = await supabase
        .from('leads')
        .select('id')
        .ilike('email', sender)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
      if (leadError)
        return NextResponse.json({ error: 'Could not match incoming email' }, { status: 500 })
      leadId = matchedLead?.id ?? null
    }
  }

  const { error } = await supabase.from('lead_interactions').upsert(
    {
      lead_id: leadId,
      client_id: clientId,
      type: interactionType,
      subject: eventSubject(type, payload.data?.subject),
      resend_email_id: emailId,
      resend_webhook_id: webhookId,
      payload: payload.data as Record<string, unknown>,
    },
    { onConflict: 'resend_webhook_id', ignoreDuplicates: true },
  )
  if (error) return NextResponse.json({ error: 'Could not record email event' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
