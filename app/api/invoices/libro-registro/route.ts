import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const log = scopedLogger('api.invoices.libro-registro')

/**
 * GET /api/invoices/libro-registro
 *
 * Exports issued invoices in CSV format for the accounting advisor.
 * This export supports the bookkeeping process; it does not replace an
 * official filing or the AEAT's own Libro Registro.
 *
 * Query params:
 *   - year: YYYY (optional, defaults to the current fiscal year)
 *   - month: YYYY-MM (optional) — exports only that calendar month
 *   - status: comma-separated invoice statuses to include (default: issued,paid,overdue,rectified)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ?? new Date().getFullYear().toString()
  const month = searchParams.get('month')
  const statusParam = searchParams.get('status') ?? 'issued,paid,overdue,rectified'
  const statuses = statusParam.split(',').map((s) => s.trim())

  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: 'El año debe tener el formato YYYY' }, { status: 400 })
  }
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: 'El mes debe tener el formato YYYY-MM' }, { status: 400 })
  }

  try {
    const supabase = await createServerClient()

    let query = notDeleted(
      supabase
        .from('invoices')
        .select(
          'full_number, issue_date, due_date, client_nif, client_name, subtotal, tax_amount, total, verifactu_csv, verifactu_status, status, payment_method, invoice_type, is_rectification, rectification_type',
        ),
    ).in('status', statuses)

    if (month) {
      const monthYear = Number(month.slice(0, 4))
      const monthNumber = Number(month.slice(5, 7))
      const nextMonth = new Date(Date.UTC(monthYear, monthNumber, 1)).toISOString().slice(0, 10)
      query = query.gte('issue_date', `${month}-01`).lt('issue_date', nextMonth)
    } else {
      query = query.gte('issue_date', `${year}-01-01`).lte('issue_date', `${year}-12-31`)
    }

    const { data: invoices, error } = await query
      .order('issue_date', { ascending: true })
      .order('full_number', { ascending: true })

    if (error) {
      log.error({ err: error.message, year, month }, 'libro_registro_query_failed')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (invoices ?? []).map((inv) => {
      // VAT rate is derived from tax_amount / subtotal (single-rate assumption for CSV export).
      // For multi-rate invoices the VAT breakdown is split in the official SII model,
      // but for the simplified Libro Registro CSV we use the effective rate.
      const subtotal = Number(inv.subtotal ?? 0)
      const taxAmount = Number(inv.tax_amount ?? 0)
      const effectiveVatRate =
        subtotal > 0 ? Math.round((taxAmount / subtotal) * 100 * 100) / 100 : 0

      return {
        'Número Factura': inv.full_number ?? '',
        'Fecha Expedición': inv.issue_date ?? '',
        'Fecha Vencimiento': inv.due_date ?? '',
        'NIF Destinatario': inv.client_nif ?? '',
        'Nombre/Razón Social': inv.client_name ?? '',
        'Tipo Factura': inv.invoice_type ?? 'F1',
        'Base Imponible': subtotal.toFixed(2),
        'Tipo IVA (%)': effectiveVatRate.toFixed(2),
        'Cuota IVA': taxAmount.toFixed(2),
        'Total Factura': Number(inv.total ?? 0).toFixed(2),
        Estado: inv.status ?? '',
        'Estado Verifactu': inv.verifactu_status ?? '',
        'CSV Verifactu': inv.verifactu_csv ?? '',
        'Medio de Cobro': inv.payment_method ?? '',
      }
    })

    const headers = Object.keys(
      rows[0] ?? {
        'Número Factura': '',
        'Fecha Expedición': '',
        'Fecha Vencimiento': '',
        'NIF Destinatario': '',
        'Nombre/Razón Social': '',
        'Tipo Factura': '',
        'Base Imponible': '',
        'Tipo IVA (%)': '',
        'Cuota IVA': '',
        'Total Factura': '',
        Estado: '',
        'Estado Verifactu': '',
        'CSV Verifactu': '',
        'Medio de Cobro': '',
      },
    )

    const csvEscape = (value: string) =>
      value.includes(',') || value.includes('"') || value.includes('\n')
        ? `"${value.replace(/"/g, '""')}"`
        : value

    const csvLines = [
      headers.map(csvEscape).join(','),
      ...rows.map((row) => headers.map((h) => csvEscape(row[h as keyof typeof row])).join(',')),
    ]

    const csv = `\uFEFF${csvLines.join('\r\n')}`
    const filename = month ? `facturas-${month}.csv` : `facturas-${year}.csv`

    log.info({ year, month, count: rows.length }, 'invoice_register_exported')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err: message }, 'libro_registro_error')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
