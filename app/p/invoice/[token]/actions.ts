'use server'

import { externalAppUrl } from '@/lib/email/app-url'
import { publicEnv, serverEnv } from '@/lib/env'
import { createRedsysPayment, getRedsysUrl } from '@/lib/integrations/redsys'
import { unlockPortalResource } from '@/lib/portal/access'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { ok: true } | { ok: false; error: string }

/** Public unlock-form submit for a password-protected invoice portal link. */
export async function unlockInvoicePortal(input: unknown): Promise<ActionResult> {
  return unlockPortalResource('invoices', input)
}

export type PaymentInitResult =
  | {
      ok: true
      url: string
      signatureVersion: string
      merchantParameters: string
      signature: string
    }
  | { ok: false; error: string }

/**
 * Initiates a Redsys payment for an invoice.
 * Creates a pending `invoice_payments` row whose `seq`-derived `redsys_order`
 * guarantees uniqueness across retries. The gateway always charges the full
 * outstanding balance of this invoice; installments are separate invoices.
 */
export async function initiatePayment(invoiceId: string, token: string): Promise<PaymentInitResult> {
  const admin = createAdminClient()
  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, status, total, number')
    .eq('id', invoiceId)
    .eq('portal_token', token)
    .maybeSingle()

  if (!invoice || !['issued', 'overdue'].includes(invoice.status as string)) {
    return { ok: false, error: 'Invoice not payable' }
  }

  const invoiceTotal = Number(invoice.total)
  const { data: confirmed } = await admin
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('status', 'confirmed')
  const paid = confirmed?.reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0
  const amount = Math.round((invoiceTotal - paid) * 100) / 100
  if (amount <= 0) return { ok: false, error: 'Invoice already fully paid' }

  // Insert pending payment row — seq auto-increments and redsys_order is generated
  const { data: payment, error: insertError } = await admin
    .from('invoice_payments')
    .insert({ invoice_id: invoiceId, amount })
    .select('redsys_order')
    .single()

  if (insertError || !payment?.redsys_order) {
    return { ok: false, error: 'Failed to create payment record' }
  }

  const env = serverEnv()
  const amountCents = Math.round(amount * 100).toString()

  const redsysData = createRedsysPayment({
    Ds_Merchant_Amount: amountCents,
    Ds_Merchant_Order: payment.redsys_order as string,
    Ds_Merchant_MerchantCode: env.REDSYS_MERCHANT_CODE,
    Ds_Merchant_Terminal: env.REDSYS_TERMINAL,
    Ds_Merchant_Currency: env.REDSYS_CURRENCY,
    Ds_Merchant_TransactionType: '0',
    Ds_Merchant_MerchantURL: `${appUrl}/api/webhooks/redsys`,
    Ds_Merchant_UrlOK: `${appUrl}/p/invoice/${token}?success=1`,
    Ds_Merchant_UrlKO: `${appUrl}/p/invoice/${token}?error=1`,
    Ds_Merchant_MerchantData: invoiceId,
  })

  return {
    ok: true,
    url: getRedsysUrl(),
    signatureVersion: redsysData.Ds_SignatureVersion,
    merchantParameters: redsysData.Ds_MerchantParameters,
    signature: redsysData.Ds_Signature,
  }
}
