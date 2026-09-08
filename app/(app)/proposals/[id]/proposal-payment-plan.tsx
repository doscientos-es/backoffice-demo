'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { PaymentPlanEditor } from '@/components/proposals/payment-plan-editor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import type { PaymentPlanItem } from '@/lib/proposals/scope'

import { updateProposalPaymentPlan } from '../actions'

type InvoiceRef = { id: string; planItemId: string; number: string; status: string }

type Props = {
  proposalId: string
  initialPlan: PaymentPlanItem[]
  initialVersion: number
  total: number
  canEdit: boolean
  invoices: InvoiceRef[]
}

/** Keeps future collection dates editable without reopening the accepted proposal. */
export function ProposalPaymentPlan({
  proposalId,
  initialPlan,
  initialVersion,
  total,
  canEdit,
  invoices,
}: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 4_000 })
  const [plan, setPlan] = useState(initialPlan)
  const [version, setVersion] = useState(initialVersion)
  const [pending, startTransition] = useTransition()

  const save = () => {
    feedback.setPending()
    startTransition(async () => {
      const result = await updateProposalPaymentPlan({
        id: proposalId,
        expected_version: version,
        payment_plan: plan,
      })
      if (!result.ok) {
        feedback.setError(result.error)
        return
      }
      setVersion(result.version)
      feedback.setSuccess('Calendario de cobros guardado')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendario de facturación</CardTitle>
        <p className="text-muted-foreground text-sm">
          Ajusta los próximos cobros sin modificar la propuesta aceptada. Los plazos ya facturados
          se gestionan desde su factura.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PaymentPlanEditor
          plan={plan}
          total={total}
          onChange={setPlan}
          locked={!canEdit}
          lockedItemIds={invoices.map((invoice) => invoice.planItemId)}
        />
        {invoices.length > 0 ? (
          <div className="border-border rounded-lg border px-3 py-2 text-sm">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="mr-3 inline-flex hover:underline"
              >
                {invoice.number} · {invoice.status}
              </Link>
            ))}
          </div>
        ) : null}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={pending}>
              Guardar calendario
            </Button>
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
