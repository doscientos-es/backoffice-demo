'use client'

import { Plus, Trash as Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PaymentPlanItem } from '@/lib/proposals/scope'
import { formatEUR } from '@/lib/utils'

type Props = {
  plan: PaymentPlanItem[]
  total: number
  onChange: (plan: PaymentPlanItem[]) => void
  locked?: boolean
  lockedItemIds?: readonly string[]
}

/** Compact editor shared by draft proposals and accepted proposal calendars. */
export function PaymentPlanEditor({
  plan,
  total,
  onChange,
  locked = false,
  lockedItemIds = [],
}: Props) {
  const lockedIds = new Set(lockedItemIds)
  const percentage = plan.reduce((sum, item) => sum + Number(item.percentage || 0), 0)
  const balanced = Math.abs(percentage - 100) < 0.001

  const update = (index: number, patch: Partial<PaymentPlanItem>) => {
    onChange(plan.map((item, current) => (current === index ? { ...item, ...patch } : item)))
  }
  const add = () => {
    onChange([
      ...plan,
      { id: crypto.randomUUID(), title: 'Nuevo plazo', percentage: 0, due_date: null },
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      {plan.map((item, index) => {
        const itemLocked = locked || lockedIds.has(item.id)
        return (
          <div
            key={item.id}
            className="border-border grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_7rem_10rem_auto]"
          >
            <Input
              aria-label={`Concepto del plazo ${index + 1}`}
              value={item.title}
              onChange={(event) => update(index, { title: event.target.value })}
              disabled={itemLocked}
              placeholder="Concepto"
            />
            <Input
              aria-label={`Porcentaje del plazo ${index + 1}`}
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={item.percentage}
              onChange={(event) => update(index, { percentage: Number(event.target.value) })}
              disabled={itemLocked}
            />
            <Input
              aria-label={`Vencimiento del plazo ${index + 1}`}
              type="date"
              value={item.due_date ?? ''}
              onChange={(event) => update(index, { due_date: event.target.value || null })}
              disabled={itemLocked}
            />
            <div className="flex items-center gap-2">
              <span className="min-w-20 text-right text-sm font-medium tabular-nums">
                {formatEUR((total * item.percentage) / 100)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Eliminar plazo ${index + 1}`}
                onClick={() => onChange(plan.filter((_, current) => current !== index))}
                disabled={itemLocked}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            {lockedIds.has(item.id) ? (
              <p className="text-muted-foreground text-xs md:col-span-4">
                Este plazo ya tiene una factura preparada; edítala desde la factura.
              </p>
            ) : null}
          </div>
        )
      })}
      {plan.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          Añade los cobros que acordéis con el cliente. Las facturas se prepararán solo al aceptar.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={
            balanced ? 'text-muted-foreground text-sm' : 'text-destructive text-sm font-medium'
          }
        >
          {plan.length === 0 ? 'Sin plazos configurados' : `Total: ${percentage.toFixed(2)} %`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          disabled={locked || plan.length >= 12}
        >
          <Plus aria-hidden /> Añadir plazo
        </Button>
      </div>
    </div>
  )
}
