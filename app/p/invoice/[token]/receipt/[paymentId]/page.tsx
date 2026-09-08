import { notFound } from 'next/navigation'

import { PaymentReceipt } from '@/components/portal/payment-receipt'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ token: string; paymentId: string }>
}) {
  const { token, paymentId } = await params
  const admin = createAdminClient()

  // Load invoice to verify token and get context
  const { data: invoice } = await admin
    .from('invoices')
    .select('*, clients(name)')
    .eq('portal_token', token)
    .maybeSingle()

  if (!invoice) notFound()

  // Load specific payment
  const { data: payment } = await admin
    .from('invoice_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('invoice_id', invoice.id as string)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (!payment) notFound()

  const { data: settings } = await admin.from('settings').select('*').eq('id', 1).maybeSingle()
  const client = (invoice as unknown as { clients: { name: string } | null }).clients

  return (
    <PaymentReceipt
      orderRef={payment.redsys_order as string | null}
      company={{
        name: settings?.company_name as string | null,
        nif: settings?.company_nif as string | null,
        address: (settings?.company_address as string | null) || null,
      }}
      recipientName={client?.name ?? '—'}
      recipientNif={invoice.client_nif as string | null}
      conceptTitle={`Factura ${invoice.full_number as string}`}
      conceptSubtitle={`Emitida el ${formatDate(invoice.issue_date as string)}`}
      confirmedAt={payment.confirmed_at as string | null}
      authorisationCode={payment.ds_authorisation_code as string | null}
      amount={Number(payment.amount)}
      footerNote="Este documento es un justificante de la transacción realizada a través de nuestra pasarela de pagos. Conserve este comprobante junto con su factura para cualquier reclamación."
    />
  )
}
