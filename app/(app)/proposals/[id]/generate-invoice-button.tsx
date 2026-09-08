'use client'

import { FileText, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import type { PaymentPlanItem } from '@/lib/proposals/scope'

import { createInvoicesFromProposalPlan, requestInvoiceFromProposal } from '../../invoices/actions'

type Props = {
  proposalId: string
  canGenerateInvoice: boolean
  paymentPlan: PaymentPlanItem[]
}

/**
 * Clone an accepted proposal into a draft invoice and navigate to the new
 * invoice so the user can adjust dates and fiscal data before issuing.
 */
export function GenerateInvoiceButton({ proposalId, canGenerateInvoice, paymentPlan }: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 4000 })
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    feedback.setPending()
    startTransition(async () => {
      if (canGenerateInvoice) {
        const res = await createInvoicesFromProposalPlan({ proposalId })
        if (!res.ok) {
          feedback.setError(res.error)
          return
        }
        feedback.setSuccess(
          res.created === 0
            ? 'Los borradores ya estaban preparados'
            : `${res.created} ${res.created === 1 ? 'borrador preparado' : 'borradores preparados'}`,
        )
        router.refresh()
      } else {
        const res = await requestInvoiceFromProposal({ proposalId })
        if (!res.ok) {
          feedback.setError(res.error)
          return
        }
        feedback.setSuccess('Solicitud enviada a administración')
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <FormFeedback
        state={feedback.state}
        pendingLabel={canGenerateInvoice ? 'Generando…' : 'Enviando…'}
      />
      <Button type="button" size="sm" variant="secondary" onClick={handleClick} disabled={pending}>
        {canGenerateInvoice ? <FileText aria-hidden /> : <Send aria-hidden />}
        {canGenerateInvoice
          ? paymentPlan.length > 1
            ? `Preparar ${paymentPlan.length} borradores`
            : 'Preparar borrador'
          : 'Solicitar facturación'}
      </Button>
    </div>
  )
}
