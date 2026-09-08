'use client'

import { FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { formatEUR } from '@/lib/utils'

import { createHourlyInvoice } from '../../invoices/actions'

type Props = {
  projectId: string
  hourlyRate: number
  hourlyVatRate: number
}

/** Current calendar month as `YYYY-MM`; caps the picker so future months can't be billed. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

/** Previous calendar month as `YYYY-MM` — the usual period billed after it ends. */
function previousMonth(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * Generates a draft invoice from the hours logged in a calendar month for an
 * hourly project. Only rendered when `billing_type === "hourly"`. Navigates to
 * the new invoice so the user can review dates and fiscal data before issuing.
 */
export function MonthlyInvoiceSection({ projectId, hourlyRate, hourlyVatRate }: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 4000 })
  const [pending, startTransition] = useTransition()
  const [month, setMonth] = useState(previousMonth)

  const handleGenerate = () => {
    feedback.setPending()
    startTransition(async () => {
      const res = await createHourlyInvoice({ projectId, month })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess('Factura creada')
      router.push(`/invoices/${res.id}`)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generar factura mensual</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Suma las horas registradas del mes y crea un borrador de factura a{' '}
          <span className="text-foreground font-medium tabular-nums">
            {formatEUR(hourlyRate)}/h
          </span>{' '}
          ({hourlyVatRate}% IVA).
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
            aria-label="Mes a facturar"
          />
          <Button size="sm" onClick={handleGenerate} disabled={pending}>
            <FileText className="size-4" aria-hidden />
            Generar borrador
          </Button>
          <FormFeedback state={feedback.state} pendingLabel="Generando…" />
        </div>
      </CardContent>
    </Card>
  )
}
