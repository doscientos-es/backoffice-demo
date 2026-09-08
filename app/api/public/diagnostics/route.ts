import { after, type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { DiagnosticReportEmail } from '@/components/email/diagnostic-report-email'
import {
  DIAGNOSTIC_PDF_BUCKET,
  diagnosticPdfStoragePath,
  toArrayBuffer,
} from '@/lib/diagnostics/pdf-cache'
import { renderDiagnosticPdf } from '@/lib/diagnostics/report'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv, serverEnv } from '@/lib/env'
import { recordConversionEvent } from '@/lib/integrations/conversion-events'
import { distributedRateLimit } from '@/lib/ratelimit'
import { getStorage } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 32_768

const Input = z.object({
  leadId: z.string().uuid().optional().nullable(),
  email: z.string().email(),
  company: z.string().trim().max(160).optional().nullable(),
  name: z.string().trim().max(160).optional().nullable(),
  answers: z
    .object({
      proceso: z.string().trim().max(500),
      personas: z.number().int().min(1).max(1000),
      minutos_por_vez: z
        .number()
        .nonnegative()
        .max(24 * 60),
      veces_por_semana: z.number().nonnegative().max(1000),
      coste_hora: z.number().nonnegative().max(100_000),
      impacto: z.string().trim().max(120),
    })
    .strict(),
  metrics: z.object({
    yearlyHours: z.number().nonnegative(),
    yearlyCost: z.number().nonnegative(),
    monthlyHours: z.number().nonnegative(),
    risk: z.string().max(40),
    primaryOpportunity: z.string().max(500),
  }),
  attribution: z.record(z.unknown()).optional().default({}),
})

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

function allowedOrigins(): string[] {
  return serverEnv().LANDING_ALLOWED_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
}

function allowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  return (
    !origin ||
    allowedOrigins().includes('*') ||
    allowedOrigins().includes(normalizeOrigin(origin)) || isLocalOrigin(origin)
  )
}

function cors(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin && allowed(request)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function landingReportUrl(request: NextRequest, diagnosticId: string, accessToken: string): string {
  const requestOrigin = request.headers.get('origin')
  const baseUrl = requestOrigin && allowed(request) ? requestOrigin : serverEnv().LANDING_URL
  const url = new URL('/diagnostico/informe', baseUrl)
  url.searchParams.set('id', diagnosticId)
  url.searchParams.set('token', accessToken)
  return url.toString()
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request) })
}

export async function POST(request: NextRequest) {
  if (!allowed(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: cors(request) })
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!(await distributedRateLimit(`public-diagnostic:${ip}`, 5)).success)
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors(request) })
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES)
    return NextResponse.json(
      { error: 'payload_too_large' },
      { status: 413, headers: cors(request) },
    )
  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES)
    return NextResponse.json(
      { error: 'payload_too_large' },
      { status: 413, headers: cors(request) },
    )
  let rawInput: unknown = null
  try {
    rawInput = JSON.parse(rawBody || 'null')
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: cors(request) })
  }
  const parsed = Input.safeParse(rawInput)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'validation_error', issues: parsed.error.flatten() },
      { status: 400, headers: cors(request) },
    )

  const input = parsed.data
  const supabase = createAdminClient()
  let leadId: string | null = null
  if (input.leadId) {
    const { data: linkedLead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', input.leadId)
      .ilike('email', input.email)
      .is('deleted_at', null)
      .maybeSingle()
    leadId = (linkedLead?.id as string | undefined) ?? null
  }
  if (!leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, company')
      .ilike('email', input.email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    leadId = (lead?.id as string | undefined) ?? null
  }
  const accessToken = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '')
  const { data: diagnostic, error } = await supabase
    .from('diagnostics')
    .insert({
      lead_id: leadId,
      email: input.email.toLowerCase(),
      company: input.company ?? null,
      answers: input.answers,
      metrics: input.metrics,
      access_token: accessToken,
      status: 'queued',
    })
    .select('id')
    .single()
  if (error || !diagnostic)
    return NextResponse.json(
      { error: 'diagnostic_failed' },
      { status: 502, headers: cors(request) },
    )

  if (leadId) {
    await supabase
      .from('leads')
      .update({
        latest_diagnostic_id: diagnostic.id,
        diagnostic_completed_at: new Date().toISOString(),
        calculator_cost: String(Math.round(input.metrics.yearlyCost)),
        calculator_hours: String(Math.round(input.metrics.yearlyHours)),
        conversion_step: 'diagnostic_completed',
      })
      .eq('id', leadId)
  }
  const pdfUrl = `${externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)}/api/public/diagnostics/${diagnostic.id}/pdf?token=${encodeURIComponent(accessToken)}`
  const reportUrl = landingReportUrl(request, diagnostic.id, accessToken)
  const eventContext = { ip, userAgent: request.headers.get('user-agent') }
  after(async () => {
    try {
      await recordConversionEvent(
        {
          event_id:
            typeof input.attribution.event_id === 'string' ? input.attribution.event_id : null,
          visitor_id:
            typeof input.attribution.visitor_id === 'string' ? input.attribution.visitor_id : null,
          lead_id: leadId,
          event_name: 'diagnostic_completed',
          conversion_step: 'diagnostic_completed',
          landing_path: '/diagnostico',
          payload: {
            diagnostic_id: diagnostic.id,
            email: input.email,
            answers: input.answers,
            metrics: input.metrics,
          },
        },
        eventContext,
      )
      const pdf = await renderDiagnosticPdf({
        name: input.name ?? input.email,
        company: input.company ?? null,
        reportUrl,
        answers: input.answers,
        metrics: input.metrics,
      })
      try {
        const { error: cacheError } = await getStorage().upload(
          DIAGNOSTIC_PDF_BUCKET,
          diagnosticPdfStoragePath(diagnostic.id),
          toArrayBuffer(pdf),
          { contentType: 'application/pdf' },
        )
        if (cacheError) console.warn('diagnostic_pdf_cache_upload_failed', cacheError)
      } catch (cacheError) {
        // The email must still be sent if Storage is temporarily unavailable.
        console.warn('diagnostic_pdf_cache_upload_failed', cacheError)
      }
      const html = await renderEmail(
        DiagnosticReportEmail({
          name: input.name ?? '',
          company: input.company,
          reportUrl,
          yearlyHours: input.metrics.yearlyHours,
          yearlyCost: input.metrics.yearlyCost,
        }),
      )
      await sendEmail({
        fromName: 'doscientos',
        fromAlias: 'hola',
        to: input.email,
        subject: `Tu diagnóstico personalizado${input.company ? ` · ${input.company}` : ''}`,
        html,
        attachments: [{ filename: 'diagnostico-doscientos.pdf', content: pdf }],
        tags: { diagnostic_id: diagnostic.id, ...(leadId ? { lead_id: leadId } : {}) },
      })
      await supabase
        .from('diagnostics')
        .update({ report_sent_at: new Date().toISOString(), status: 'sent' })
        .eq('id', diagnostic.id)
      await recordConversionEvent(
        {
          event_name: 'diagnostic_report_sent',
          conversion_step: 'diagnostic_report_sent',
          lead_id: leadId,
          landing_path: '/diagnostico',
          payload: { diagnostic_id: diagnostic.id },
        },
        eventContext,
      )
    } catch (sendError) {
      console.error('diagnostic_report_send_failed', sendError)
    }
  })

  return NextResponse.json(
    { ok: true, diagnosticId: diagnostic.id, leadId, reportUrl, pdfUrl },
    { status: 201, headers: cors(request) },
  )
}
