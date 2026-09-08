import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { csvWithBom, quarterlyPeriod } from '@/lib/exports/quarterly-invoices'
import { scopedLogger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('api.invoices.trimestral')
const EXPORTABLE_INVOICE_STATUSES = ['issued', 'paid', 'overdue', 'rectified']
const CSV_HEADERS = [
  'Tipo',
  'Número / referencia',
  'Fecha',
  'Contraparte',
  'NIF',
  'Categoría',
  'Base',
  'IVA',
  'Total',
  'Estado',
  'Estado Verifactu',
  'CSV Verifactu',
  'Adjuntos',
  'Enlaces Drive',
] as const

type QuarterlyInvoice = {
  id: string
  full_number: string | null
  issue_date: string | null
  client_name: string | null
  client_nif: string | null
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  status: string | null
  verifactu_status: string | null
  verifactu_csv: string | null
}

type QuarterlyExpense = {
  id: string
  vendor: string
  category: string | null
  expense_date: string
  invoice_reference: string | null
  vendor_nif: string | null
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  currency: string | null
}

type ExpenseAttachment = {
  expense_id: string
  name: string
  web_view_link: string | null
}

/** Creates a lightweight CSV register for the accountant for one calendar quarter. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = quarterlyPeriod(searchParams.get('year'), searchParams.get('quarter'))
  if (!period) {
    return NextResponse.json(
      { error: 'Indica un año YYYY y un trimestre entre 1 y 4' },
      { status: 400 },
    )
  }

  try {
    const supabase = await createServerClient()
    const [invoicesResult, expensesResult] = await Promise.all([
      supabase
        .from('invoices')
        .select(
          'id, full_number, issue_date, client_name, client_nif, subtotal, tax_amount, total, status, verifactu_status, verifactu_csv',
        )
        .is('deleted_at', null)
        .in('status', EXPORTABLE_INVOICE_STATUSES)
        .gte('issue_date', period.start)
        .lt('issue_date', period.end)
        .order('issue_date', { ascending: true })
        .order('full_number', { ascending: true }),
      supabase
        .from('expenses')
        .select(
          'id, vendor, category, expense_date, invoice_reference, vendor_nif, subtotal, tax_amount, total, currency',
        )
        .is('deleted_at', null)
        .gte('expense_date', period.start)
        .lt('expense_date', period.end)
        .order('expense_date', { ascending: true })
        .order('vendor', { ascending: true }),
    ])
    if (invoicesResult.error) throw new Error(invoicesResult.error.message)
    if (expensesResult.error) throw new Error(expensesResult.error.message)

    const invoices = (invoicesResult.data ?? []) as unknown as QuarterlyInvoice[]
    const expenses = (expensesResult.data ?? []) as unknown as QuarterlyExpense[]
    const expenseIds = expenses.map((expense) => expense.id)
    const attachmentsResult =
      expenseIds.length === 0
        ? { data: [] as ExpenseAttachment[], error: null }
        : await supabase
            .from('attachments')
            .select('expense_id, name, web_view_link')
            .is('deleted_at', null)
            .in('expense_id', expenseIds)
            .order('name', { ascending: true })
    if (attachmentsResult.error) throw new Error(attachmentsResult.error.message)
    const attachments = (attachmentsResult.data ?? []) as unknown as ExpenseAttachment[]

    const attachmentsByExpense = new Map<string, ExpenseAttachment[]>()
    for (const attachment of attachments) {
      const current = attachmentsByExpense.get(attachment.expense_id) ?? []
      current.push(attachment)
      attachmentsByExpense.set(attachment.expense_id, current)
    }
    const rows = [
      ...invoices.map((invoice) => ({
        Tipo: 'Cobro',
        'Número / referencia': invoice.full_number ?? '',
        Fecha: invoice.issue_date ?? '',
        Contraparte: invoice.client_name ?? '',
        NIF: invoice.client_nif ?? '',
        Categoría: '',
        Base: Number(invoice.subtotal ?? 0).toFixed(2),
        IVA: Number(invoice.tax_amount ?? 0).toFixed(2),
        Total: Number(invoice.total ?? 0).toFixed(2),
        Estado: invoice.status ?? '',
        'Estado Verifactu': invoice.verifactu_status ?? '',
        'CSV Verifactu': invoice.verifactu_csv ?? '',
        Adjuntos: 'PDF disponible para descarga manual desde la factura',
        'Enlaces Drive': '',
      })),
      ...expenses.map((expense) => {
        const expenseAttachments = attachmentsByExpense.get(expense.id) ?? []
        return {
          Tipo: 'Gasto',
          'Número / referencia': expense.invoice_reference ?? '',
          Fecha: expense.expense_date,
          Contraparte: expense.vendor,
          NIF: expense.vendor_nif ?? '',
          Categoría: expense.category ?? '',
          Base: Number(expense.subtotal ?? 0).toFixed(2),
          IVA: Number(expense.tax_amount ?? 0).toFixed(2),
          Total: Number(expense.total ?? 0).toFixed(2),
          Estado: '',
          'Estado Verifactu': '',
          'CSV Verifactu': '',
          Adjuntos: expenseAttachments.map((attachment) => attachment.name).join(' · '),
          'Enlaces Drive': expenseAttachments
            .map((attachment) => attachment.web_view_link)
            .filter((link): link is string => Boolean(link))
            .join(' · '),
        }
      }),
    ]
    const csv = csvWithBom(rows, CSV_HEADERS)
    const filename = `doscientos-${period.label.replace(' ', '-')}.csv`
    log.info(
      { quarter: period.label, invoices: invoices.length, expenseAttachments: attachments.length },
      'quarterly_advisor_csv_exported',
    )
    return new NextResponse(new TextDecoder().decode(csv), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    log.error({ err: error, quarter: period.label }, 'quarterly_advisor_archive_failed')
    return NextResponse.json({ error: 'No se pudo generar el archivo trimestral' }, { status: 500 })
  }
}
