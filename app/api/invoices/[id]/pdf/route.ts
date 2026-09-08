import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { renderInvoicePdf } from '@/lib/invoices/invoice-pdf-document'
import { buildInvoicePdfData, invoicePdfFilename } from '@/lib/invoices/pdf-data'
import { findWorkLogsForInvoice, getInvoiceDetail } from '@/lib/invoices/queries'

export const dynamic = 'force-dynamic'

/**
 * Internal invoice PDF download. Requires an authenticated team member and
 * reuses the shared PDF pipeline so the document matches the HTML detail view.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const detail = await getInvoiceDetail(id)
  if (!detail) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  const { invoice, items, settings } = detail
  const workLogs = await findWorkLogsForInvoice(invoice.id)
  const data = await buildInvoicePdfData({
    invoice,
    clientName: invoice.client?.name ?? null,
    clientLogoUrl: invoice.client?.logo_url ?? null,
    items,
    settings,
    workLogs,
  })

  const pdf = await renderInvoicePdf(data)
  const filename = invoicePdfFilename(invoice.full_number, invoice.id)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
