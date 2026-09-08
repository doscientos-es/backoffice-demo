'use client'

import { LoaderCircle as Loader2, Send } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'

import { updateInvoiceStatus } from '../actions'
import type {
  InvoiceFeedback,
  InvoiceIssuanceResult,
  VerifyInvoiceStatusChange,
} from './invoice-action-contracts'
import {
  type InvoiceIssuancePhase,
  InvoiceIssuanceProgressDialog,
} from './invoice-issuance-progress-dialog'

function issuancePhaseForDelivery(status: string | null): InvoiceIssuancePhase {
  if (status === 'accepted') return 'accepted'
  if (status === 'rejected') return 'rejected'
  if (status === 'error') return 'delivery_error'
  return 'deferred'
}

interface Props {
  invoiceId: string
  feedback: InvoiceFeedback
  verifyStatusChange: VerifyInvoiceStatusChange
  onIssued: () => void
}

/** Owns the fiscal issuance workflow and its progress dialog. */
export function InvoiceIssuanceAction({
  invoiceId,
  feedback,
  verifyStatusChange,
  onIssued,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<InvoiceIssuanceResult>({
    phase: 'verifying',
    error: null,
    csv: null,
  })

  const handleIssue = async () => {
    if (!(await verifyStatusChange('issued'))) return
    feedback.setPending()
    setResult({ phase: 'processing', error: null, csv: null })
    setOpen(true)
    startTransition(async () => {
      const response = await updateInvoiceStatus({ id: invoiceId, status: 'issued' })
      if (!response.ok) {
        feedback.setError(response.error)
        setResult({ phase: 'error', error: response.error, csv: null })
        return
      }

      const phase = issuancePhaseForDelivery(response.fiscalDeliveryStatus)
      setResult({ phase, error: null, csv: response.fiscalDeliveryCsv })
      if (phase === 'accepted') feedback.setSuccess('Factura emitida y aceptada por AEAT')
      else if (phase === 'rejected')
        feedback.setError('La factura se emitió, pero AEAT rechazó el registro fiscal.')
      else if (phase === 'delivery_error')
        feedback.setError('La factura se emitió; la entrega fiscal requiere atención.')
      else feedback.setSuccess('Factura emitida. La entrega fiscal sigue en la cola durable.')
      onIssued()
    })
  }

  return (
    <>
      <Button
        className="justify-center whitespace-nowrap"
        size="sm"
        disabled={pending || open}
        onClick={handleIssue}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {pending ? 'Emitiendo…' : 'Emitir'}
      </Button>
      <InvoiceIssuanceProgressDialog
        open={open}
        phase={result.phase}
        error={result.error}
        csv={result.csv}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
