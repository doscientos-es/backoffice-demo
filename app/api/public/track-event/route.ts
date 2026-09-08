import { type NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/env'
import {
  clientIp,
  isLikelyBot,
  PublicTrackEventInput,
  recordConversionEvent,
} from '@/lib/integrations/conversion-events'
import { distributedRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Eventos por IP y minuto. Generoso: una visita normal manda 2-4. */
const RATE_LIMIT = 60

/** Cortafuegos contra payloads absurdos enviados a mano. */
const MAX_BODY_BYTES = 4096

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

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  const allowed = allowedOrigins()
  if (allowed.includes('*')) headers['Access-Control-Allow-Origin'] = '*'
  else if (origin && allowed.includes(normalizeOrigin(origin)))
    headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function isAllowedOrigin(origin: string | null): boolean {
  const allowed = allowedOrigins()
  return (
    allowed.includes('*') ||
    (Boolean(origin) && allowed.includes(normalizeOrigin(origin as string)))
  )
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  })
}

/**
 * POST /api/public/track-event
 *
 * Eventos intermedios de la landing (page_view, calculator_used, …). La landing
 * los manda con `navigator.sendBeacon` y cuerpo `text/plain` a propósito: es un
 * content-type de la lista segura de CORS, así que el navegador no dispara
 * preflight y la petición sale sin bloquear el hilo principal ni el render.
 *
 * Siempre responde 204: el cliente no lee la respuesta y un error de tracking
 * jamás debe verse en la landing. Los descartes (bot, origen, validación) se
 * cuentan como silencio, no como fallo.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const cors = corsHeaders(origin)
  const noop = new NextResponse(null, { status: 204, headers: cors })

  if (origin && !isAllowedOrigin(origin)) return noop

  // Los crawlers no ejecutan JS, así que aquí solo llegan clientes fabricados.
  if (isLikelyBot(request.headers.get('user-agent'))) return noop

  const ip = clientIp(request)
  if (!(await distributedRateLimit(`public-track:${ip}`, RATE_LIMIT)).success) return noop

  const body = await request.text()
  if (!body || body.length > MAX_BODY_BYTES) return noop

  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    return noop
  }

  const parsed = PublicTrackEventInput.safeParse(raw)
  if (!parsed.success) return noop

  await recordConversionEvent(parsed.data, {
    ip,
    userAgent: request.headers.get('user-agent'),
  })

  return noop
}
