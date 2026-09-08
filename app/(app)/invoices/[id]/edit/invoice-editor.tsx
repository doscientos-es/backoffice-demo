'use client'

import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { LineItemsTable } from '@/components/finance/line-items-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { FormRow } from '@/components/ui/form-row'
import { Textarea } from '@/components/ui/textarea'
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'
import { EMPTY_LINE_ITEM, type LineItem } from '@/lib/finance'

import { updateInvoice } from '../../actions'

export type EditableItem = LineItem

/**
 * Initial items may come straight from the DB without a stable client-side
 * `id` (e.g. when the invoice_items query omits it). The editor assigns a
 * UUID at mount time, so we accept items where `id` is optional.
 */
export type InitialEditableItem = Omit<LineItem, 'id'> & { id?: string }

export type InvoiceEditorProps = {
  id: string
  initialIssueDate: string
  initialDueDate: string | null
  initialNotes: string | null
  initialPaymentTerms: string | null
  initialItems: InitialEditableItem[]
  initialVersion: number
  /** When true, fields are read-only (invoice issued). */
  locked: boolean
}

export function InvoiceEditor({
  id,
  initialIssueDate,
  initialDueDate,
  initialNotes,
  initialPaymentTerms,
  initialItems,
  initialVersion,
  locked,
}: InvoiceEditorProps) {
  const router = useRouter()
  const [saving, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [expectedVersion, setExpectedVersion] = useState(initialVersion)
  const [conflictOpen, setConflictOpen] = useState(false)

  const [issueDate, setIssueDate] = useState(initialIssueDate)
  const [dueDate, setDueDate] = useState(initialDueDate ?? '')
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [paymentTerms, setPaymentTerms] = useState(initialPaymentTerms ?? '')
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.length > 0
      ? initialItems.map((it) => ({ ...it, id: it.id || crypto.randomUUID() }))
      : [{ ...EMPTY_LINE_ITEM, id: crypto.randomUUID() } as EditableItem],
  )

  // Track whether there are unsaved changes.
  const [dirty, setDirty] = useState(false)
  const isFirstRender = useRef(true)

  // biome-ignore lint/correctness/useExhaustiveDependencies: react to any change in these fields
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setDirty(true)
    setError(null)
  }, [issueDate, dueDate, notes, paymentTerms, items])

  const buildPayload = () => ({
    id,
    expected_version: expectedVersion,
    issue_date: issueDate,
    due_date: dueDate || null,
    notes: notes || null,
    payment_terms: paymentTerms || null,
    items,
  })

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateInvoice(buildPayload())
      if (!res.ok) {
        if (res.code === 'conflict') setConflictOpen(true)
        else setError(res.error)
      } else {
        setExpectedVersion(res.version)
        setDirty(false)
        setError(null)
      }
    })
  }

  const handleSaveAndReturn = () => {
    startTransition(async () => {
      const res = await updateInvoice(buildPayload())
      if (!res.ok) {
        if (res.code === 'conflict') setConflictOpen(true)
        else setError(res.error)
      } else {
        router.push(`/invoices/${id}`)
      }
    })
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Conceptos</CardTitle>
              <CardDescription>
                Añade cada servicio o producto. Los importes y el IVA se calculan automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <LineItemsTable items={items} onChange={setItems} locked={locked} />
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormRow label="Fecha de emisión" htmlFor="issue-date">
                <DateField
                  id="issue-date"
                  value={issueDate}
                  onChange={setIssueDate}
                  disabled={locked}
                />
              </FormRow>
              <FormRow label="Fecha de vencimiento" htmlFor="due-date">
                <DateField id="due-date" value={dueDate} onChange={setDueDate} disabled={locked} />
              </FormRow>
              <FormRow label="Notas" htmlFor="notes">
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={locked}
                  rows={6}
                  placeholder="Notas internas o para el cliente…"
                />
              </FormRow>
              <FormRow label="Términos de pago" htmlFor="payment-terms">
                <Textarea
                  id="payment-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={locked}
                  rows={4}
                  placeholder="Se usa el valor por defecto de la empresa si se deja vacío…"
                />
              </FormRow>
            </CardContent>
          </Card>
        </div>

        {/* Sticky action bar */}
        <div className="border-border bg-background/85 supports-backdrop-filter:bg-background/70 sticky bottom-0 z-10 -mx-4 -mb-4 border-t backdrop-blur md:-mx-6 md:-mb-6">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="text-sm">
              {error && <span className="text-destructive">{error}</span>}
              {!error && dirty && !saving && (
                <span className="text-muted-foreground">Cambios sin guardar</span>
              )}
              {!error && !dirty && !saving && (
                <span className="text-muted-foreground">Sin cambios pendientes</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/invoices/${id}`}>
                  <ArrowLeft className="size-3.5" />
                  Volver
                </Link>
              </Button>
              {!locked && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || !dirty}
                    onClick={handleSave}
                  >
                    <Save className="size-3.5" />
                    {saving ? 'Guardando…' : 'Guardar'}
                  </Button>
                  <Button size="sm" disabled={saving} onClick={handleSaveAndReturn}>
                    <Save className="size-3.5" />
                    {saving ? 'Guardando…' : 'Guardar y volver'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <VersionConflictDialog
        open={conflictOpen}
        entityName="factura"
        onKeepEditing={() => setConflictOpen(false)}
        onReload={() => {
          setConflictOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
