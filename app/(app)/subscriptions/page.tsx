import { FileText, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ListPage } from '@/components/layout/list-page'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePageRole } from '@/lib/auth'
import {
  SUBSCRIPTION_BILLING_CYCLE,
  SUBSCRIPTION_STATUS,
  type SubscriptionBillingCycle,
  type SubscriptionStatus,
} from '@/lib/status'
import { getDefaultSubscriptionInvoiceId } from '@/lib/subscriptions/invoice-history'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'
import {
  parseEnumParam,
  parsePage,
  parseSortParam,
  parseStringParam,
} from '@/lib/utils/search-params'

const SUBSCRIPTION_SORT_COLUMNS = ['name', 'status', 'amount', 'next_invoice_date'] as const

export const metadata: Metadata = { title: 'Suscripciones · doscientos' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const STATUS_OPTIONS = (Object.keys(SUBSCRIPTION_STATUS) as SubscriptionStatus[]).map((v) => ({
  value: v,
  label: SUBSCRIPTION_STATUS[v].label,
}))

const BILLING_OPTIONS = (Object.keys(SUBSCRIPTION_BILLING_CYCLE) as SubscriptionBillingCycle[]).map(
  (v) => ({ value: v, label: SUBSCRIPTION_BILLING_CYCLE[v] }),
)

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePageRole(['owner', 'admin'])
  const sp = await searchParams

  const q = parseStringParam(sp, 'q')
  const status = parseEnumParam(
    sp,
    'status',
    Object.keys(SUBSCRIPTION_STATUS) as SubscriptionStatus[],
  )
  const billingCycle = parseEnumParam(
    sp,
    'billing_cycle',
    Object.keys(SUBSCRIPTION_BILLING_CYCLE) as SubscriptionBillingCycle[],
  )
  const page = parsePage(sp)
  const { sort, dir } = parseSortParam(sp, SUBSCRIPTION_SORT_COLUMNS, 'next_invoice_date', 'asc')
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createServerClient()

  let query = supabase
    .from('subscriptions')
    .select(
      'id, name, status, billing_cycle, amount, vat_rate, next_invoice_date, clients(id, name)',
      {
        count: 'exact',
      },
    )
    .is('deleted_at', null)

  if (q) query = query.ilike('name', `%${q}%`)
  if (status) query = query.eq('status', status)
  if (billingCycle) query = query.eq('billing_cycle', billingCycle)

  const { data, error, count } = await query
    .order(sort, { ascending: dir === 'asc', nullsFirst: false })
    .range(from, to)

  type Row = {
    id: string
    name: string
    status: string
    billing_cycle: string
    amount: number
    vat_rate: number
    next_invoice_date: string | null
    clients: { id: string; name: string } | null
  }

  type SubscriptionInvoice = {
    id: string
    subscription_id: string
    subscription_period_start: string | null
  }

  const subscriptions = (data as unknown as Row[]) ?? []
  const subscriptionIds = subscriptions.map((subscription) => subscription.id)
  let invoiceData: unknown[] = []
  let invoiceError: { message: string } | null = null
  if (subscriptionIds.length) {
    const result = await supabase
      .from('invoices')
      .select('id, subscription_id, subscription_period_start')
      .in('subscription_id', subscriptionIds)
      .is('deleted_at', null)
      .order('subscription_period_start', { ascending: false, nullsFirst: false })
    invoiceData = result.data ?? []
    invoiceError = result.error
  }

  const invoicesBySubscription = new Map<string, SubscriptionInvoice[]>()
  for (const invoice of invoiceData as SubscriptionInvoice[]) {
    invoicesBySubscription.set(invoice.subscription_id, [
      ...(invoicesBySubscription.get(invoice.subscription_id) ?? []),
      invoice,
    ])
  }

  const defaultInvoiceBySubscription = new Map<string, SubscriptionInvoice>()
  for (const [subscriptionId, invoices] of invoicesBySubscription) {
    const defaultInvoiceId = getDefaultSubscriptionInvoiceId(invoices)
    const defaultInvoice = invoices.find((invoice) => invoice.id === defaultInvoiceId)
    if (defaultInvoice) defaultInvoiceBySubscription.set(subscriptionId, defaultInvoice)
  }

  const rows = subscriptions.map((s) => ({
    id: s.id,
    href: `/subscriptions/${s.id}`,
    cells: [
      s.name,
      s.clients ? (
        <Link key="client" href={`/clients/${s.clients.id}`} className="hover:underline">
          {s.clients.name}
        </Link>
      ) : null,
      <StatusBadge key="status" meta={SUBSCRIPTION_STATUS} value={s.status} />,
      SUBSCRIPTION_BILLING_CYCLE[s.billing_cycle as SubscriptionBillingCycle] ?? s.billing_cycle,
      formatEUR(s.amount),
      formatDate(s.next_invoice_date),
    ],
    sortValues: [
      s.name,
      s.clients?.name ?? '',
      s.status,
      s.billing_cycle,
      s.amount,
      s.next_invoice_date ?? '',
    ],
    csvValues: [
      s.name,
      s.clients?.name ?? '',
      SUBSCRIPTION_STATUS[s.status as SubscriptionStatus]?.label ?? s.status,
      SUBSCRIPTION_BILLING_CYCLE[s.billing_cycle as SubscriptionBillingCycle] ?? s.billing_cycle,
      s.amount,
      s.next_invoice_date ?? '',
    ],
    rowActions: defaultInvoiceBySubscription.has(s.id) ? (
      <Button asChild size="sm" variant="outline">
        <Link href={`/invoices/${defaultInvoiceBySubscription.get(s.id)?.id}`}>
          <FileText className="size-3.5" />
          Ver factura
        </Link>
      </Button>
    ) : (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="Aún no hay facturas automáticas generadas"
      >
        <FileText className="size-3.5" />
        Sin factura
      </Button>
    ),
  }))

  return (
    <ListPage
      title="Suscripciones"
      description="Servicios recurrentes con facturación periódica."
      headers={[
        { label: 'Nombre', sortKey: 'name' },
        'Cliente',
        { label: 'Estado', sortKey: 'status' },
        'Ciclo',
        { label: 'Importe base', align: 'right', sortKey: 'amount' },
        { label: 'Próxima factura', sortKey: 'next_invoice_date' },
      ]}
      align={['left', 'left', 'left', 'left', 'right', 'left']}
      rows={rows}
      empty={q || status || billingCycle ? 'Sin coincidencias.' : 'Aún no hay suscripciones.'}
      error={error?.message ?? invoiceError?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      filters={[
        { key: 'status', label: 'Estado', options: STATUS_OPTIONS },
        { key: 'billing_cycle', label: 'Ciclo', options: BILLING_OPTIONS },
      ]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      exportFilename="suscripciones"
      actions={
        <Link
          href="/subscriptions/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium shadow-xs"
        >
          <Plus className="size-4" />
          Nueva suscripción
        </Link>
      }
      addHref="/subscriptions/new"
      addLabel="Nueva suscripción"
    />
  )
}
