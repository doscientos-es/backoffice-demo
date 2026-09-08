import { notFound, redirect } from 'next/navigation'

import { PageHeader } from '@/components/layout/page-header'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import { InvoiceEditor } from './invoice-editor'

export const dynamic = 'force-dynamic'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireUser()
  const supabase = await createServerClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(id, name), projects(id, name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!invoice) notFound()

  // If the invoice is already issued or beyond, we shouldn't allow editing basic fields
  // although the editor handles 'locked' state, it's safer to redirect if not in draft.
  if (invoice.status !== 'draft') {
    redirect(`/invoices/${id}`)
  }

  const { data: items } = await supabase
    .from('invoice_items')
    .select('id, description, quantity, unit_price, vat_rate')
    .eq('invoice_id', id)
    .order('position')

  // biome-ignore lint/suspicious/noExplicitAny: joined tables from Supabase query
  const client = (invoice as any).clients

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Editar Factura ${invoice.full_number}`}
        description={client?.name}
        breadcrumbs={[
          { label: 'Facturas', href: '/invoices' },
          { label: invoice.full_number as string, href: `/invoices/${id}` },
          { label: 'Editar' },
        ]}
      />

      <InvoiceEditor
        key={invoice.version as number}
        id={id}
        initialVersion={Number(invoice.version)}
        initialIssueDate={invoice.issue_date}
        initialDueDate={invoice.due_date}
        initialNotes={invoice.notes}
        initialPaymentTerms={invoice.payment_terms}
        initialItems={items ?? []}
        locked={invoice.status !== 'draft'}
      />
    </div>
  )
}
