import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { clientIp, isLikelyBot } from '@/lib/integrations/conversion-events'
import { scopedLogger } from '@/lib/logger'
import { distributedRateLimit } from '@/lib/ratelimit'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('public-whatsapp-click')
const RATE_LIMIT = 20

function normalizeOrigin(value: string): string {
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function allowedOrigins(): string[] {
  return serverEnv().LANDING_ALLOWED_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
}

function isAllowedOrigin(origin: string | null): boolean {
  const allowed = allowedOrigins()
  return (
    allowed.includes('*') ||
    !origin ||
    (Boolean(origin) && allowed.includes(normalizeOrigin(origin as string)))
  )
}

function safeText(value: string | null, max: number): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 })
  }

  const ip = clientIp(request)
  const rl = await distributedRateLimit(`public-whatsapp:${ip}`, RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const url = request.nextUrl
  const phone = safeText(url.searchParams.get('phone'), 30) ?? '34671171525'
  const text = safeText(url.searchParams.get('text'), 600) ?? ''
  const target = new URL(`https://wa.me/${phone.replace(/\D/g, '')}`)
  if (text) target.searchParams.set('text', text)

  const userAgent = request.headers.get('user-agent')

  // SEO/social crawlers recrawl every link on the site, including this footer
  // CTA — don't let them inflate the WhatsApp click count. Always redirect
  // either way so the link keeps working (and bots don't get a broken page).
  if (!isLikelyBot(userAgent)) {
    const payload = {
      event_id: safeText(url.searchParams.get('event_id'), 120),
      visitor_id: safeText(url.searchParams.get('visitor_id'), 120),
      event_name: 'whatsapp_click',
      conversion_step: safeText(url.searchParams.get('conversion_step'), 120) ?? 'whatsapp_click',
      landing_path: safeText(url.searchParams.get('landing_path'), 500),
      landing_ref: safeText(url.searchParams.get('landing_ref'), 200),
      referrer: safeText(url.searchParams.get('referrer'), 500) ?? request.headers.get('referer'),
      utm_source: safeText(url.searchParams.get('utm_source'), 200),
      utm_medium: safeText(url.searchParams.get('utm_medium'), 200),
      utm_campaign: safeText(url.searchParams.get('utm_campaign'), 200),
      utm_term: safeText(url.searchParams.get('utm_term'), 200),
      utm_content: safeText(url.searchParams.get('utm_content'), 200),
      ip,
      user_agent: userAgent,
      payload: {
        target: target.toString(),
      },
    }

    try {
      await createAdminClient().from('conversion_events').insert(payload)
    } catch (err) {
      log.warn({ err }, 'whatsapp click event insert failed')
    }
  }

  return NextResponse.redirect(target, { status: 302 })
}
