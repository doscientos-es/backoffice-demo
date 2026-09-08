import { type NextRequest, NextResponse } from 'next/server'

import {
  DIAGNOSTIC_PDF_BUCKET,
  diagnosticPdfStoragePath,
  toArrayBuffer,
} from '@/lib/diagnostics/pdf-cache'
import { renderDiagnosticPdf } from '@/lib/diagnostics/report'
import { serverEnv } from '@/lib/env'
import { recordConversionEvent } from '@/lib/integrations/conversion-events'
import { getStorage } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return new NextResponse('No autorizado', { status: 401 })
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('diagnostics')
    .select('id, lead_id, email, company, answers, metrics')
    .eq('id', id)
    .eq('access_token', token)
    .maybeSingle()
  if (!data) return new NextResponse('Informe no encontrado', { status: 404 })
  const reportUrl = new URL('/diagnostico/informe', serverEnv().LANDING_URL)
  reportUrl.searchParams.set('id', id)
  reportUrl.searchParams.set('token', token)
  const storage = getStorage()
  let pdf: Uint8Array | null = null
  try {
    const cached = await storage.download(DIAGNOSTIC_PDF_BUCKET, diagnosticPdfStoragePath(id))
    if (cached.data) pdf = new Uint8Array(cached.data)
  } catch (cacheError) {
    console.warn('diagnostic_pdf_cache_read_failed', cacheError)
  }
  if (!pdf) {
    pdf = await renderDiagnosticPdf({
      name: data.email,
      company: data.company,
      reportUrl: reportUrl.toString(),
      answers: data.answers as Record<string, unknown>,
      metrics: data.metrics as {
        yearlyHours: number
        yearlyCost: number
        monthlyHours: number
        risk: string
        primaryOpportunity: string
      },
    })
    try {
      const { error: cacheError } = await storage.upload(
        DIAGNOSTIC_PDF_BUCKET,
        diagnosticPdfStoragePath(id),
        toArrayBuffer(pdf),
        { contentType: 'application/pdf' },
      )
      if (cacheError) console.warn('diagnostic_pdf_cache_upload_failed', cacheError)
    } catch (cacheError) {
      // A failed cache must not prevent delivery of a valid report.
      console.warn('diagnostic_pdf_cache_upload_failed', cacheError)
    }
  }
  await supabase
    .from('diagnostics')
    .update({ report_opened_at: new Date().toISOString() })
    .eq('id', id)
  await recordConversionEvent({
    event_name: 'diagnostic_report_opened',
    conversion_step: 'diagnostic_report_opened',
    lead_id: data.lead_id as string | null,
    landing_path: '/diagnostico',
    payload: { diagnostic_id: id },
  })
  return new NextResponse(toArrayBuffer(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="diagnostico-doscientos.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
