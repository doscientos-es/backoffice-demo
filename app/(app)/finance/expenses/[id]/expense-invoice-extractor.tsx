'use client'

import { LoaderCircle as Loader2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  ExpenseCategoryType,
  ExpensePaymentSourceType,
  ExpenseRecurrenceType,
  ExpenseStatusType,
} from '@/lib/schemas/expense'

import { updateExpense } from '../actions'

type Suggestion = {
  vendor: string | null
  description: string | null
  expense_date: string | null
  due_date: string | null
  subtotal: number | null
  tax_rate: number | null
  vendor_nif: string | null
  invoice_reference: string | null
  confidence: number
}

type Props = {
  expense: {
    id: string
    expected_version: number
    vendor: string
    description: string
    category: ExpenseCategoryType
    status: ExpenseStatusType
    recurrence: ExpenseRecurrenceType
    expense_date: string
    due_date: string
    paid_at: string
    currency: string
    subtotal: number
    tax_rate: number
    vendor_nif: string
    invoice_reference: string
    project_id: string
    notes: string
    payment_source: ExpensePaymentSourceType
    paid_by_member_id: string
    version: number
  }
  attachments: Array<{
    id: string
    name: string
    mime_type: string | null
    source?: string | null
  }>
}

const labels: Array<[keyof Omit<Suggestion, 'confidence'>, string]> = [
  ['vendor', 'Proveedor'],
  ['vendor_nif', 'NIF'],
  ['invoice_reference', 'Nº factura'],
  ['expense_date', 'Fecha'],
  ['due_date', 'Vencimiento'],
  ['description', 'Concepto'],
  ['subtotal', 'Base imponible'],
  ['tax_rate', 'IVA'],
]

export function ExpenseInvoiceExtractor({ expense, attachments }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [attachmentId, setAttachmentId] = useState(attachments[0]?.id ?? '')
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [source, setSource] = useState<'ai' | 'rules' | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (attachments.length === 0) return null

  async function extract() {
    if (!attachmentId || pending) return
    startTransition(async () => {
      setError(null)
      try {
        const response = await fetch('/api/expenses/extract-invoice', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attachment_id: attachmentId }),
        })
        const result = (await response.json()) as Suggestion & {
          source?: 'ai' | 'rules'
          warning?: string | null
          error?: string
        }
        if (!response.ok) throw new Error(result.error ?? 'No se pudo analizar el PDF')
        setSuggestion(result)
        setSource(result.source ?? null)
        setWarning(result.warning ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo analizar el PDF')
      }
    })
  }

  function apply() {
    if (!suggestion || pending) return
    startTransition(async () => {
      setError(null)
      const result = await updateExpense({
        ...expense,
        expected_version: expense.version,
        vendor: suggestion.vendor ?? expense.vendor,
        description: suggestion.description ?? expense.description ?? '',
        expense_date: suggestion.expense_date ?? expense.expense_date,
        due_date: suggestion.due_date ?? expense.due_date ?? '',
        subtotal: suggestion.subtotal ?? expense.subtotal,
        tax_rate: suggestion.tax_rate ?? expense.tax_rate,
        vendor_nif: suggestion.vendor_nif ?? expense.vendor_nif ?? '',
        invoice_reference: suggestion.invoice_reference ?? expense.invoice_reference ?? '',
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuggestion(null)
      router.refresh()
    })
  }

  return (
    <div className="border-border bg-muted/20 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
      <select
        aria-label="Factura a analizar"
        className="border-input bg-background h-8 max-w-64 rounded-md border px-2 text-sm"
        value={attachmentId}
        onChange={(event) => setAttachmentId(event.target.value)}
        disabled={pending}
      >
        {attachments.map((attachment) => (
          <option key={attachment.id} value={attachment.id}>
            {attachment.name}
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" size="sm" onClick={extract} disabled={pending}>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {pending ? 'Analizando…' : 'Extraer datos'}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Dialog open={suggestion !== null} onOpenChange={(open) => !open && setSuggestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datos extraídos</DialogTitle>
            <DialogDescription>
              {source === 'ai'
                ? 'Propuesta generada con IA.'
                : 'Propuesta obtenida con reglas locales.'}{' '}
              Revisa los datos antes de aplicarlos.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {suggestion &&
              labels.map(([key, label]) =>
                suggestion[key] !== null ? (
                  <div key={key}>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="font-medium">
                      {key === 'tax_rate' ? `${suggestion[key]}%` : suggestion[key]}
                    </dd>
                  </div>
                ) : null,
              )}
          </dl>
          {warning ? <p className="text-sm text-amber-700 dark:text-amber-300">{warning}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSuggestion(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={apply} disabled={pending}>
              {pending ? 'Aplicando…' : 'Aplicar al gasto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
