'use client'

import { Download, FileText as FileEdit } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { IconButton } from '@/components/ui/icon-button'

import type { InvoiceActionInvoice } from './invoice-action-contracts'
import { aeatDeliveryLabel, getInvoiceActionPolicy } from './invoice-action-policy'
import { InvoiceIssuanceAction } from './invoice-issuance-action'
import { InvoiceMoreActions } from './invoice-more-actions'
import { InvoicePaymentActions } from './invoice-payment-actions'
import { RegularizeAeatButton } from './regularize-aeat-button'
import { SendAeatButton } from './send-aeat-button'
import { SendInvoiceButton } from './send-invoice-button'
import { useInvoiceStatusVerification } from './use-invoice-status-verification'

interface Props {
  invoice: InvoiceActionInvoice
  clientEmail?: string | null
  recipientFiscalReady?: boolean
}

/**
 * Composition root for invoice actions. Policy, security checks and individual
 * financial workflows live in focused modules so this component only declares
 * the visible action surface.
 */
export function InvoiceActions({ invoice, clientEmail, recipientFiscalReady }: Props) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const policy = getInvoiceActionPolicy(invoice)
  const { challenge, verifyStatusChange } = useInvoiceStatusVerification(invoice.id, feedback)

  return (
    <div className="flex w-fit max-w-full min-w-0 flex-col items-end gap-2">
      {challenge}
      {feedback.state.status !== 'idle' ? (
        <div className="max-w-full min-w-0">
          <FormFeedback state={feedback.state} className="max-w-full min-w-0" />
        </div>
      ) : null}

      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
        <IconButton variant="outline" label="Descargar PDF" className="shrink-0" asChild>
          <a href={`/api/invoices/${invoice.id}/pdf`}>
            <Download className="h-4 w-4" />
          </a>
        </IconButton>
        {policy.canEdit ? (
          <IconButton variant="outline" label="Editar factura" className="shrink-0" asChild>
            <Link href={`/invoices/${invoice.id}/edit`}>
              <FileEdit className="h-4 w-4" />
            </Link>
          </IconButton>
        ) : null}
        {policy.canSendEmail ? (
          <SendInvoiceButton invoiceId={invoice.id} defaultEmail={clientEmail} iconOnly />
        ) : null}
        <InvoiceMoreActions
          invoiceId={invoice.id}
          canCancel={policy.canCancel}
          canDelete={policy.canDelete}
          canRectify={policy.canRectify}
          canMarkUncollectible={policy.canMarkUncollectible}
          feedback={feedback}
          verifyStatusChange={verifyStatusChange}
        />
      </div>

      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
        {policy.canIssue ? (
          <InvoiceIssuanceAction
            invoiceId={invoice.id}
            feedback={feedback}
            verifyStatusChange={verifyStatusChange}
            onIssued={() => router.refresh()}
          />
        ) : null}
        <InvoicePaymentActions
          invoiceId={invoice.id}
          total={invoice.total}
          amountPaid={invoice.amountPaid}
          canRecordPayment={policy.canRecordPayment}
          canRevertPayment={policy.canRevertPayment}
          feedback={feedback}
          verifyStatusChange={verifyStatusChange}
          onChanged={() => router.refresh()}
        />
        {policy.shouldSendToAeat ? (
          <SendAeatButton
            invoiceId={invoice.id}
            isRegularization={invoice.is_regularization_pending}
            label={
              invoice.is_regularization_pending
                ? 'Enviar regularización a AEAT'
                : aeatDeliveryLabel(invoice.verifactu_status)
            }
          />
        ) : null}
        {policy.shouldRegularizeAeat ? (
          <RegularizeAeatButton
            invoiceId={invoice.id}
            recipientFiscalReady={recipientFiscalReady}
          />
        ) : null}
      </div>
    </div>
  )
}
