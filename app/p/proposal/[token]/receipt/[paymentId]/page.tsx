import { notFound } from 'next/navigation'

import { PaymentReceipt } from '@/components/portal/payment-receipt'
import { formatAddress } from '@/lib/address'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function ProposalReceiptPage({
  params,
}: {
  params: Promise<{ token: string; paymentId: string }>
}) {
  const { token, paymentId } = await params
  const admin = createAdminClient()

  // Load proposal to verify token and get context
  const { data: proposal } = await admin
    .from('proposals')
    .select('*, clients(name, nif, billing_address), leads(name, company)')
    .eq('portal_token', token)
    .maybeSingle()

  if (!proposal) notFound()

  // Load specific payment
  const { data: payment } = await admin
    .from('invoice_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('proposal_id', proposal.id as string)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (!payment) notFound()

  const { data: settings } = await admin.from('settings').select('*').eq('id', 1).maybeSingle()

  const proposalRow = proposal as unknown as {
    clients: { name?: string; nif?: string } | null
    leads: { name?: string; company?: string } | null
    accepted_fiscal_data: { nif?: string } | null
  }
  const client = proposalRow.clients
  const lead = proposalRow.leads
  const recipientName = client?.name ?? lead?.company ?? lead?.name ?? '—'
  const recipientNif = client?.nif ?? proposalRow.accepted_fiscal_data?.nif ?? ''

  return (
    <PaymentReceipt
      orderRef={payment.redsys_order as string | null}
      company={{
        name: settings?.company_name as string | null,
        nif: settings?.company_nif as string | null,
        address: settings
          ? formatAddress({
              street: settings.company_address_street as string | null,
              zip: settings.company_address_zip as string | null,
              city: settings.company_address_city as string | null,
              province: settings.company_address_province as string | null,
              country: settings.company_address_country as string | null,
            }) || null
          : null,
      }}
      recipientName={recipientName}
      recipientNif={recipientNif}
      conceptTitle={`Reserva de proyecto: ${proposal.title as string}`}
      conceptSubtitle={`Presupuesto ${proposal.number as string}`}
      confirmedAt={payment.confirmed_at as string | null}
      authorisationCode={payment.ds_authorisation_code as string | null}
      amount={Number(payment.amount)}
      footerNote="Este documento es un justificante de la transacción realizada a través de nuestra pasarela de pagos. Conserve este comprobante junto con su presupuesto aceptado."
    />
  )
}
