'use client'

import { Copy, Plus, Trash as Trash2 } from 'lucide-react'
import { useRef } from 'react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLES,
  type BillingCycle,
  computeLineSubtotal,
  computeLineTotals,
  computeProposalTotals,
  EMPTY_LINE_ITEM,
  type LineItem,
} from '@/lib/finance'
import { formatEUR } from '@/lib/utils'

export type LineItemsTableProps = {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  /** When true, every input is disabled. Used by invoice/proposal edit views. */
  locked?: boolean
  /**
   * When true, renders the cadence selector per line and a bucketed totals
   * footer (one-time + recurring). Used by proposals; invoices keep the
   * one-shot layout.
   */
  showBillingCycle?: boolean
}

const RECURRING_CYCLES: ReadonlyArray<Exclude<BillingCycle, 'none'>> = [
  'monthly',
  'quarterly',
  'yearly',
]

/**
 * Editable line-items table shared by invoice and proposal editors. Owns the
 * desglose UI (Subtotal / IVA / Total) so callers only deal with the items
 * array; totals are derived via `computeLineTotals` or, when cadence is
 * enabled, via `computeProposalTotals` (one-time + recurring buckets).
 */
export function LineItemsTable({
  items,
  onChange,
  locked = false,
  showBillingCycle = false,
}: LineItemsTableProps) {
  const flat = computeLineTotals(items)
  const bucketed = computeProposalTotals(items)
  const recurringRows = showBillingCycle
    ? RECURRING_CYCLES.filter((c) => bucketed[c].total > 0)
    : []
  const descriptionRefs = useRef(new Map<string, HTMLInputElement>())

  const update = (i: number, patch: Partial<LineItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const focusDescription = (id: string) => {
    requestAnimationFrame(() => descriptionRefs.current.get(id)?.focus())
  }
  const add = () => {
    const id = crypto.randomUUID()
    onChange([...items, { ...EMPTY_LINE_ITEM, id }])
    focusDescription(id)
  }
  const duplicate = (i: number) => {
    const source = items[i]
    if (!source) return
    const copy: LineItem = { ...source, id: crypto.randomUUID() }
    onChange([...items.slice(0, i + 1), copy, ...items.slice(i + 1)])
    focusDescription(copy.id)
  }
  const remove = (i: number) =>
    onChange(items.length === 1 ? items : items.filter((_, idx) => idx !== i))

  const columns = showBillingCycle
    ? 'md:grid-cols-[minmax(12rem,1fr)_8rem_5rem_8rem_6rem_8rem_5rem]'
    : 'md:grid-cols-[minmax(12rem,1fr)_5rem_8rem_6rem_8rem_5rem]'

  return (
    <div className="overflow-hidden">
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="sr-only">Líneas de factura</legend>
        <div
          className={`border-border bg-muted/40 text-muted-foreground hidden items-center gap-2 border-b px-3 py-2 text-xs font-medium md:grid ${columns}`}
        >
          <span>Descripción</span>
          {showBillingCycle && <span>Cadencia</span>}
          <span className="text-right">Cantidad</span>
          <span className="text-right">Precio unitario</span>
          <span className="text-right">IVA</span>
          <span className="text-right">Importe</span>
          <span className="sr-only">Acciones</span>
        </div>

        <div className="divide-border divide-y">
          {items.map((it, i) => (
            <div
              key={it.id}
              className={`focus-within:bg-muted/25 grid grid-cols-2 items-start gap-3 p-4 transition-colors md:items-center md:gap-2 md:px-3 md:py-2.5 ${columns}`}
            >
              <div className="col-span-2 md:col-span-1">
                <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                  Descripción
                </span>
                <Input
                  ref={(node) => {
                    if (node) descriptionRefs.current.set(it.id, node)
                    else descriptionRefs.current.delete(it.id)
                  }}
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !locked) {
                      e.preventDefault()
                      add()
                    }
                  }}
                  disabled={locked}
                  placeholder="Servicio o producto"
                  maxLength={500}
                  aria-label={`Descripción línea ${i + 1}`}
                />
              </div>

              {showBillingCycle && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                    Cadencia
                  </span>
                  <Select
                    value={it.billing_cycle ?? 'none'}
                    onChange={(e) => update(i, { billing_cycle: e.target.value as BillingCycle })}
                    disabled={locked}
                    aria-label={`Cadencia línea ${i + 1}`}
                  >
                    {BILLING_CYCLES.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {BILLING_CYCLE_LABELS[cycle]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                  Cantidad
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={it.quantity || ''}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
                  disabled={locked}
                  className="text-right tabular-nums"
                  aria-label={`Cantidad línea ${i + 1}`}
                />
              </div>

              <div>
                <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                  Precio unitario
                </span>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={it.unit_price || ''}
                    onChange={(e) => update(i, { unit_price: Number(e.target.value) || 0 })}
                    disabled={locked}
                    className="pr-8 text-right tabular-nums"
                    aria-label={`Precio unitario línea ${i + 1}`}
                  />
                  <span
                    className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
                    aria-hidden="true"
                  >
                    €
                  </span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                  IVA
                </span>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    max="100"
                    list="common-vat-rates"
                    value={it.vat_rate}
                    onChange={(e) => update(i, { vat_rate: Number(e.target.value) || 0 })}
                    disabled={locked}
                    className="pr-8 text-right tabular-nums"
                    aria-label={`IVA línea ${i + 1}`}
                  />
                  <span
                    className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
                    aria-hidden="true"
                  >
                    %
                  </span>
                </div>
              </div>

              <div className="flex flex-col md:items-end">
                <span className="text-muted-foreground mb-1 text-xs font-medium md:hidden">
                  Importe
                </span>
                <span className="flex h-9 items-center font-semibold tabular-nums">
                  {formatEUR(computeLineSubtotal(it))}
                </span>
              </div>

              <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                <button
                  type="button"
                  onClick={() => duplicate(i)}
                  disabled={locked}
                  aria-label={`Duplicar línea ${i + 1}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-9 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
                >
                  <Copy className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={locked || items.length === 1}
                  aria-label={`Eliminar línea ${i + 1}`}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex size-9 items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <datalist id="common-vat-rates">
        <option value="0" />
        <option value="4" />
        <option value="10" />
        <option value="21" />
      </datalist>

      <div className="border-border bg-muted/30 flex flex-col gap-5 border-t p-4 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={add}
          disabled={locked}
          className="border-border text-primary hover:border-primary/50 hover:bg-primary/5 inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-dashed px-3 text-sm font-medium disabled:pointer-events-none disabled:opacity-50 sm:justify-start"
        >
          <Plus className="size-4" aria-hidden="true" /> Añadir concepto
        </button>

        <dl className="flex w-full flex-col gap-2 text-sm sm:max-w-xs">
          {showBillingCycle && recurringRows.length > 0 ? (
            <>
              <div className="text-muted-foreground flex justify-between gap-4">
                <dt>Inversión inicial</dt>
                <dd className="tabular-nums">{formatEUR(bucketed.oneTime.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-medium">
                <dt>Total único (IVA incl.)</dt>
                <dd className="tabular-nums">{formatEUR(bucketed.oneTime.total)}</dd>
              </div>
              {recurringRows.map((cycle) => (
                <div key={cycle} className="text-muted-foreground flex justify-between gap-4">
                  <dt>{BILLING_CYCLE_LABELS[cycle]} (IVA incl.)</dt>
                  <dd className="tabular-nums">{formatEUR(bucketed[cycle].total)}</dd>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="text-muted-foreground flex justify-between gap-4">
                <dt>Base imponible</dt>
                <dd className="tabular-nums">{formatEUR(flat.subtotal)}</dd>
              </div>
              <div className="text-muted-foreground flex justify-between gap-4">
                <dt>IVA</dt>
                <dd className="tabular-nums">{formatEUR(flat.taxAmount)}</dd>
              </div>
              <div className="bg-background ring-foreground/10 mt-1 flex items-center justify-between gap-4 rounded-lg px-4 py-3 font-semibold shadow-sm ring-1">
                <dt>Total</dt>
                <dd className="text-lg tabular-nums">{formatEUR(flat.total)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
