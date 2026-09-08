import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { ingestLead } from '@/lib/integrations/lead-intake'
import {
  fetchMetaLeadgen,
  logMetaError,
  type MetaWebhookPayload,
  mapMetaLeadgenToIntake,
  verifyMetaSignature,
} from '@/lib/integrations/meta-leads'
import { scopedLogger } from '@/lib/logger'
import { processMetaCommentEvent } from '@/lib/social/automation/service'
import { parseMetaCommentEvents } from '@/lib/social/meta/webhook'

// Webhooks must never be cached or pre-rendered.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const socialLog = scopedLogger('meta-social-webhook')

/**
 * GET handshake — Meta calls this once when subscribing the webhook.
 * Doc: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export async function GET(request: NextRequest) {
  const env = serverEnv()
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (!env.META_VERIFY_TOKEN) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
  }
  if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN && challenge) {
    // Meta expects the raw challenge string (not JSON).
    return new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

/**
 * POST — Meta sends a leadgen event. We MUST respond 200 quickly even on
 * partial failure (otherwise Meta retries up to 36h and floods the endpoint).
 * Internal failures are logged; ingestion errors return 200 with `partial: true`.
 */
export async function POST(request: NextRequest) {
  const env = serverEnv()
  if (!env.META_APP_SECRET || !env.META_PAGE_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 })
  }

  const raw = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  if (!verifyMetaSignature(env.META_APP_SECRET, raw, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(raw) as MetaWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const socialEvents = parseMetaCommentEvents(payload)
  const socialResults = await Promise.allSettled(socialEvents.map(processMetaCommentEvent))
  const socialFailed = socialResults.filter((result) => result.status === 'rejected').length
  if (socialFailed > 0) {
    socialLog.error(
      { failed: socialFailed, total: socialEvents.length },
      'meta_social_webhook_partial_failure',
    )
  }

  if (payload.object !== 'page' || !Array.isArray(payload.entry)) {
    return NextResponse.json({ ok: true, socialReceived: socialEvents.length, socialFailed })
  }

  let processed = 0
  let failed = 0
  let duplicates = 0

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue
      const leadgenId = change.value?.leadgen_id
      if (!leadgenId) {
        failed++
        continue
      }
      try {
        const graphRes = await fetchMetaLeadgen(leadgenId)
        const intake = mapMetaLeadgenToIntake(graphRes, {
          pageId: change.value.page_id,
          createdTime: change.value.created_time,
        })
        const result = await ingestLead(intake)
        if (result.ok) {
          processed++
          if (result.duplicate) duplicates++
        } else {
          failed++
          logMetaError('ingestLead failed', { leadgenId, error: result.error })
        }
      } catch (err) {
        failed++
        logMetaError('leadgen fetch failed', {
          leadgenId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    duplicates,
    failed,
    socialReceived: socialEvents.length,
    socialFailed,
    partial: failed > 0,
  })
}
