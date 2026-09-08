import { Download, ExternalLink, FileText } from 'lucide-react'
import Link from 'next/link'

import { ListPage } from '@/components/layout/list-page'
import { Button } from '@/components/ui/button'
import { requirePageRole } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

export const metadata = { title: 'Facturas recibidas · doscientos' }
export const dynamic = 'force-dynamic'

type ReceivedInvoice = {
  id: string
  name: string
  created_at: string
  source: 'storage' | 'drive' | null
  web_view_link: string | null
  expenses: {
    id: string
    vendor: string
    invoice_reference: string | null
    expense_date: string
    total: number | null
  } | null
}

export default async function ReceivedInvoicesPage() {
  await requirePageRole(['owner', 'admin'])
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('attachments')
    .select(
      'id, name, created_at, source, web_view_link, expenses!expense_id(id, vendor, invoice_reference, expense_date, total)',
    )
    .not('expense_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const invoices = (data ?? []) as unknown as ReceivedInvoice[]

  return (
    <ListPage
      title="Facturas recibidas"
      description="Documentos adjuntos a gastos de proveedores."
      breadcrumbs={[{ label: 'Finanzas', href: '/finance' }, { label: 'Facturas recibidas' }]}
      empty="Aún no hay facturas ni justificantes adjuntos a gastos."
      error={error?.message}
      headers={[
        'Archivo',
        'Proveedor',
        'Nº factura',
        'Fecha gasto',
        { label: 'Total', align: 'right' },
        '',
      ]}
      align={['left', 'left', 'left', 'left', 'right', 'right']}
      rows={invoices.map((invoice) => {
        const expense = invoice.expenses
        return {
          id: invoice.id,
          href: expense ? `/finance/expenses/${expense.id}` : undefined,
          cells: [
            <span key="name" className="flex items-center gap-2 font-medium">
              <FileText className="text-muted-foreground size-4" aria-hidden />
              <span className="max-w-72 truncate">{invoice.name}</span>
            </span>,
            expense?.vendor ?? '—',
            expense?.invoice_reference ?? '—',
            expense ? formatDate(expense.expense_date) : '—',
            <span key="total" className="tabular-nums">
              {expense ? formatEUR(Number(expense.total ?? 0)) : '—'}
            </span>,
            invoice.source === 'drive' && invoice.web_view_link ? (
              <Button key="open" asChild variant="ghost" size="icon" className="size-7">
                <a
                  href={invoice.web_view_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir en Drive"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            ) : (
              <Button key="download" asChild variant="ghost" size="icon" className="size-7">
                <Link
                  href={`/api/documents/${invoice.id}/download`}
                  target="_blank"
                  aria-label="Descargar factura"
                >
                  <Download className="size-3.5" />
                </Link>
              </Button>
            ),
          ],
        }
      })}
    />
  )
}
