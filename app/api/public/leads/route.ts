import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { LandingLeadInput, mapLandingToIntake } from '@/lib/integrations/landing'
import { ingestLead } from '@/lib/integrations/lead-intake'
import { scopedLogger } from '@/lib/logger'
import { distributedRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('public-leads')

/** Max submissions per IP per minute. */
const RATE_LIMIT = 5

/**
 * Normalize an origin for comparison. Tolerates the common misconfigurations
 * that silently break CORS in production: surrounding quotes (Vercel values
 * pasted as `"https://..."`), stray whitespace, a trailing slash, and casing.
 */
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
    (Boolean(origin) && allowed.includes(normalizeOrigin(origin as string)))
  )
}

/** CORS headers reflecting the request origin only when it is allowlisted. */
function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  const allowed = allowedOrigins()
  if (allowed.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*'
  } else if (origin && allowed.includes(normalizeOrigin(origin))) {
    // Echo the request's original Origin header (browsers require an exact match).
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/** CORS preflight. */
export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  })
}

/**
 * POST /api/public/leads
 *
 * Public endpoint the landing form calls on submit. Browser-facing, so it is
 * protected by an origin allowlist + per-IP rate limit + honeypot rather than a
 * secret token (which can't be hidden in client-side code). The service-role
 * insert happens server-side via ingestLead().
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const cors = corsHeaders(origin)

  // Reject cross-origin browser calls from non-allowlisted sites.
  if (origin && !isAllowedOrigin(origin)) {
    log.warn({ origin }, 'blocked submission from disallowed origin')
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: cors })
  }

  const ip = clientIp(request)
  const rl = await distributedRateLimit(`public-lead:${ip}`, RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: cors })
  }

  const parsed = LandingLeadInput.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', issues: parsed.error.flatten() },
      { status: 400, headers: cors },
    )
  }

  // Honeypot: pretend success so bots don't probe, but store nothing.
  if (parsed.data.website?.trim()) {
    log.warn({ ip }, 'honeypot triggered, dropping submission')
    return NextResponse.json({ ok: true }, { status: 200, headers: cors })
  }

  const intake = mapLandingToIntake(parsed.data, {
    ip,
    userAgent: request.headers.get('user-agent'),
  })

  const result = await ingestLead(intake)
  if (!result.ok) {
    log.error({ error: result.error }, 'ingestLead failed')
    return NextResponse.json({ error: 'intake_failed' }, { status: 502, headers: cors })
  }

  return NextResponse.json(
    { ok: true, duplicate: result.duplicate, leadId: result.leadId },
    { status: 201, headers: cors },
  )
}
