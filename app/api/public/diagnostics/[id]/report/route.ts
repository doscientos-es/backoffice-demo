import { after, type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import { recordConversionEvent } from '@/lib/integrations/conversion-events'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeOrigin(value: string): string {
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true
  const allowedOrigins = serverEnv()
    .LANDING_ALLOWED_ORIGINS.split(',')
    .map(normalizeOrigin)
    .filter(Boolean)
  return (
    allowedOrigins.includes('*') ||
    allowedOrigins.includes(normalizeOrigin(origin)) || isLocalOrigin(origin)
  )
}

function cors(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  }
  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * Returns only the diagnostic data required by the landing report.
 * The token is the capability to read this resource; email and lead IDs are
 * intentionally never returned to the browser.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request.headers.get('origin'))) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: cors(request) })
  }

  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')
  if (!token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: cors(request) })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('diagnostics')
    .select('id, lead_id, company, answers, metrics')
    .eq('id', id)
    .eq('access_token', token)
    .maybeSingle()
  if (!data)
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: cors(request) })

  after(async () => {
    await Promise.allSettled([
      supabase
        .from('diagnostics')
        .update({ report_opened_at: new Date().toISOString() })
        .eq('id', id),
      recordConversionEvent({
        event_name: 'diagnostic_report_opened',
        conversion_step: 'diagnostic_report_opened',
        lead_id: data.lead_id as string | null,
        landing_path: '/diagnostico/informe',
        payload: { diagnostic_id: id, source: 'landing' },
      }),
    ])
  })

  return NextResponse.json(
    {
      company: typeof data.company === 'string' ? data.company : null,
      answers: objectValue(data.answers),
      metrics: objectValue(data.metrics),
    },
    { headers: cors(request) },
  )
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request) })
}
