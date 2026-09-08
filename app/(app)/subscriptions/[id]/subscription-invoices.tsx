'use client'

import { ArrowUpRight, FileText } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { INVOICE_STATUS } from '@/lib/status'
import { getDefaultSubscriptionInvoiceId } from '@/lib/subscriptions/invoice-history'
import { formatDate, formatEUR } from '@/lib/utils'

export type SubscriptionInvoice = {
  id: string
  full_number: string | null
  subscription_period_start: string | null
  issue_date: string | null
  total: number
  status: string
}

export function SubscriptionInvoices({ invoices }: { invoices: SubscriptionInvoice[] }) {
  const defaultInvoiceId = getDefaultSubscriptionInvoiceId(invoices)
  const [selectedId, setSelectedId] = useState(defaultInvoiceId ?? '')
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0]

  if (!selectedInvoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Facturas automáticas</CardTitle>
          <CardDescription>
            Las facturas generadas para esta suscripción aparecerán aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex items-center gap-2 text-sm">
          <FileText className="size-4" /> Aún no se ha generado ninguna factura.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas automáticas</CardTitle>
        <CardDescription>
          Por defecto se muestra el último período facturado. Puedes consultar los anteriores.
        </CardDescription>
        <CardAction>
          <Button asChild size="sm">
            <Link href={`/invoices/${selectedInvoice.id}`}>
              Ver factura <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label htmlFor="subscription-invoice" className="grid gap-1.5 text-sm font-medium">
          Período facturado
          <Select
            id="subscription-invoice"
            value={selectedInvoice.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {formatDate(invoice.subscription_period_start ?? invoice.issue_date)} ·{' '}
                {invoice.full_number ?? 'Borrador'}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-3 text-sm sm:pb-0.5">
          <StatusBadge meta={INVOICE_STATUS} value={selectedInvoice.status} />
          <span className="font-medium">{formatEUR(selectedInvoice.total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
