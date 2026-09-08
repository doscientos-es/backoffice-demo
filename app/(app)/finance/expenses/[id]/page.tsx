import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { PageHeader } from '@/components/layout/page-header'
import { type AttachmentItem, AttachmentSection } from '@/components/ui/attachment-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DangerZone } from '@/components/ui/danger-zone'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePageRole } from '@/lib/auth'
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_SOURCE_LABELS,
  EXPENSE_RECURRENCE_LABELS,
} from '@/lib/finance'
import { getExpenseDetail } from '@/lib/finance/queries'
import { EXPENSE_STATUS } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

import { deleteExpense } from '../actions'
import { ExpenseEditDialog } from './expense-edit-dialog'
import { ExpenseInvoiceExtractor } from './expense-invoice-extractor'

export const dynamic = 'force-dynamic'

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePageRole(['owner', 'admin'])

  const supabase = await createServerClient()
  const [result, { data: teamMembersRaw }, { data: attachments, error: attachmentsError }] =
    await Promise.all([
      getExpenseDetail(id),
      supabase.from('team_members').select('id, name').is('deleted_at', null).order('name'),
      supabase
        .from('attachments')
        .select('id, name, mime_type, size_bytes, created_at, source, web_view_link')
        .eq('expense_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ])

  if (!result) notFound()
  if (attachmentsError) throw new Error(attachmentsError.message)
  const { expense, projectOptions } = result
  const project = expense.project
  const teamMembers = (teamMembersRaw ?? []) as Array<{ id: string; name: string }>

  const canDelete = user.role === 'owner' || user.role === 'admin'
  const canEdit = user.role !== 'viewer'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={expense.vendor}
        description={EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
        breadcrumbs={[
          { label: 'Finanzas', href: '/finance' },
          { label: 'Gastos', href: '/finance/expenses' },
          { label: expense.vendor },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge meta={EXPENSE_STATUS} value={expense.status} />
            {canEdit ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/finance/expenses/new?from=${id}`}>Duplicar</Link>
              </Button>
            ) : null}
            {canEdit ? (
              <ExpenseEditDialog
                expense={{
                  id: expense.id,
                  vendor: expense.vendor,
                  description: expense.description,
                  category: expense.category,
                  status: expense.status,
                  recurrence: expense.recurrence,
                  expense_date: expense.expense_date,
                  due_date: expense.due_date,
                  paid_at: expense.paid_at,
                  currency: expense.currency,
                  subtotal: expense.subtotal,
                  tax_rate: expense.tax_rate,
                  vendor_nif: expense.vendor_nif,
                  invoice_reference: expense.invoice_reference,
                  project_id: expense.project_id,
                  notes: expense.notes,
                  payment_source: expense.payment_source,
                  paid_by_member_id: expense.paid_by_member_id,
                  version: Number(expense.version),
                }}
                projects={projectOptions}
                teamMembers={teamMembers}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Proveedor">{expense.vendor}</DetailRow>
              <DetailRow label="Categoría">
                {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
              </DetailRow>
              <DetailRow label="Pagado desde">
                {expense.payment_source === 'member' && expense.paid_by_member_name
                  ? `${EXPENSE_PAYMENT_SOURCE_LABELS.member} · ${expense.paid_by_member_name}`
                  : (EXPENSE_PAYMENT_SOURCE_LABELS[expense.payment_source] ??
                    expense.payment_source)}
              </DetailRow>
              <DetailRow label="Recurrencia">
                {EXPENSE_RECURRENCE_LABELS[expense.recurrence] ?? expense.recurrence}
              </DetailRow>
              <DetailRow label="Fecha">{formatDate(expense.expense_date)}</DetailRow>
              <DetailRow label="Vencimiento">{formatDate(expense.due_date)}</DetailRow>
              <DetailRow label="Pagado">{formatDate(expense.paid_at)}</DetailRow>
              <DetailRow label="Subtotal">
                <span className="tabular-nums">{formatEUR(expense.subtotal)}</span>
              </DetailRow>
              <DetailRow label="IVA">
                <span className="tabular-nums">
                  {expense.tax_rate}% · {formatEUR(expense.tax_amount)}
                </span>
              </DetailRow>
              <DetailRow label="Total">
                <span className="font-semibold tabular-nums">{formatEUR(expense.total)}</span>
              </DetailRow>
              {project ? (
                <DetailRow label="Proyecto">
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                  {project.clientName ? (
                    <span className="text-muted-foreground"> · {project.clientName}</span>
                  ) : null}
                </DetailRow>
              ) : null}
              {expense.invoice_reference ? (
                <DetailRow label="Nº factura">{expense.invoice_reference}</DetailRow>
              ) : null}
              {expense.vendor_nif ? <DetailRow label="NIF">{expense.vendor_nif}</DetailRow> : null}
            </DetailGrid>
            {expense.notes ? (
              <div className="border-border mt-4 border-t pt-3">
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  Notas
                </p>
                <p className="text-sm whitespace-pre-wrap">{expense.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <AttachmentSection
          entityType="expense"
          entityId={id}
          attachments={(attachments ?? []) as AttachmentItem[]}
          canEdit={canEdit}
          title="Facturas y justificantes"
        />
        {canEdit ? (
          <ExpenseInvoiceExtractor
            expense={{
              id: expense.id,
              expected_version: Number(expense.version),
              vendor: expense.vendor,
              description: expense.description ?? '',
              category: expense.category,
              status: expense.status,
              recurrence: expense.recurrence,
              expense_date: expense.expense_date,
              due_date: expense.due_date ?? '',
              paid_at: expense.paid_at ?? '',
              currency: expense.currency,
              subtotal: expense.subtotal,
              tax_rate: expense.tax_rate,
              vendor_nif: expense.vendor_nif ?? '',
              invoice_reference: expense.invoice_reference ?? '',
              project_id: expense.project_id ?? '',
              notes: expense.notes ?? '',
              payment_source: expense.payment_source,
              paid_by_member_id: expense.paid_by_member_id ?? '',
              version: Number(expense.version),
            }}
            attachments={(attachments ?? [])
              .filter(
                (attachment) =>
                  attachment.mime_type === 'application/pdf' && attachment.source !== 'drive',
              )
              .map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                mime_type: attachment.mime_type,
                source: attachment.source,
              }))}
          />
        ) : null}
      </div>

      {canDelete ? (
        <DangerZone>
          <form action={deleteExpense} className="flex items-center justify-between gap-3">
            <input type="hidden" name="id" value={id} />
            <p className="text-muted-foreground text-sm">
              El gasto se eliminará del listado y dejará de contar en finanzas.
            </p>
            <Button type="submit" variant="destructive" size="sm">
              Eliminar gasto
            </Button>
          </form>
        </DangerZone>
      ) : null}
    </div>
  )
}
