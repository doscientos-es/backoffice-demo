import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { DangerZone } from '@/components/ui/danger-zone'
import { StatusBadge } from '@/components/ui/status-badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { requireUser } from '@/lib/auth'
import { computeLineTotals } from '@/lib/finance'
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

import { deleteSubscription } from '../actions'
import { SubscriptionEditForm } from './subscription-edit-form'
import { type SubscriptionInvoice, SubscriptionInvoices } from './subscription-invoices'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Suscripción · doscientos' }

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const canEdit = user.role !== 'viewer'

  const supabase = await createServerClient()

  const [{ data: sub }, { data: clients }, { data: projects }, { data: invoices }] =
    await Promise.all([
      supabase
        .from('subscriptions')
        .select('*, clients(id, name), projects(id, name)')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
      supabase
        .from('invoices')
        .select('id, full_number, subscription_period_start, issue_date, total, status')
        .eq('subscription_id', id)
        .is('deleted_at', null)
        .order('subscription_period_start', { ascending: false, nullsFirst: false }),
    ])

  if (!sub) notFound()

  const clientsArr = (clients ?? []) as { id: string; name: string }[]
  const projectsArr = (projects ?? []) as { id: string; name: string }[]

  const { total: totalWithVat } = computeLineTotals([
    { quantity: 1, unit_price: Number(sub.amount), vat_rate: Number(sub.vat_rate) },
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/subscriptions" label="Suscripciones" />
        <PageHeader
          title={sub.name as string}
          description={`${formatEUR(totalWithVat)} IVA incl. · ${formatDate(sub.next_invoice_date as string | null)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge meta={SUBSCRIPTION_STATUS} value={sub.status as SubscriptionStatus} />
            </div>
          }
        />
      </div>

      {canEdit ? (
        <Card>
          <CardContent className="pt-6">
            <SubscriptionEditForm
              id={id}
              version={Number(sub.version)}
              clients={clientsArr}
              projects={projectsArr}
              defaults={{
                client_id: sub.client_id as string,
                project_id: (sub.project_id as string | null) ?? '',
                name: sub.name as string,
                description: (sub.description as string | null) ?? '',
                status: sub.status as string,
                billing_cycle: sub.billing_cycle as string,
                amount: Number(sub.amount),
                vat_rate: Number(sub.vat_rate),
                start_date: sub.start_date as string,
                end_date: (sub.end_date as string | null) ?? '',
                notes: (sub.notes as string | null) ?? '',
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <SubscriptionInvoices
        invoices={((invoices ?? []) as unknown as SubscriptionInvoice[]).map((invoice) => ({
          ...invoice,
          total: Number(invoice.total),
        }))}
      />

      {canEdit && user.role !== 'member' ? (
        <DangerZone
          title="Eliminar suscripción"
          description="Se eliminará de forma permanente. Esta acción no se puede deshacer."
        >
          <form
            action={async () => {
              'use server'
              await deleteSubscription({ id })
              redirect('/subscriptions')
            }}
          >
            <SubmitButton variant="destructive">Eliminar suscripción</SubmitButton>
          </form>
        </DangerZone>
      ) : null}
    </div>
  )
}
