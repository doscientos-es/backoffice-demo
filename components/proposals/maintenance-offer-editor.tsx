'use client'

import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  MAINTENANCE_LIMITS,
  type MaintenanceOffer,
  recommendedMaintenancePlanId,
} from '@/lib/proposals/maintenance'
import { formatEUR } from '@/lib/utils'

type Props = {
  offer: MaintenanceOffer
  selectedPlanId: string | null
  onChange: (offer: MaintenanceOffer) => void
  onSelectedPlanChange: (planId: string | null) => void
  locked: boolean
}

function listLines(value: string, maxItems: number): string[] {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|[0-9]+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
}

function MaintenanceListTextarea({
  items,
  onChange,
  disabled,
  maxItems,
  label,
  ariaLabel,
  placeholder,
  className,
}: {
  items: string[]
  onChange: (items: string[]) => void
  disabled: boolean
  maxItems: number
  label: string
  ariaLabel: string
  placeholder: string
  className: string
}) {
  const [draft, setDraft] = useState(() => items.join('\n'))
  const editing = useRef(false)
  const count = listLines(draft, maxItems).length

  useEffect(() => {
    const nextDraft = items.join('\n')
    if (!editing.current && draft !== nextDraft) setDraft(nextDraft)
  }, [draft, items])

  const commit = () => {
    editing.current = false
    const nextItems = listLines(draft, maxItems)
    setDraft(nextItems.join('\n'))
    onChange(nextItems)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-muted-foreground text-[11px] font-normal tabular-nums">
          {count}/{maxItems}
        </span>
      </div>
      <Textarea
        value={draft}
        onChange={(event) => {
          editing.current = true
          setDraft(event.target.value)
        }}
        onFocus={() => {
          editing.current = true
        }}
        onBlur={commit}
        disabled={disabled}
        rows={5}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
      />
      <p className="text-muted-foreground text-[11px] font-normal">
        Un punto por línea. Puedes pegar una lista con viñetas.
      </p>
    </>
  )
}

/** Proposal-scoped maintenance plans. Copy and pricing remain editable per quote. */
export function MaintenanceOfferEditor({
  offer,
  selectedPlanId,
  onChange,
  onSelectedPlanChange,
  locked,
}: Props) {
  const recommendedPlanId = recommendedMaintenancePlanId(offer)
  const patchPlan = (index: number, patch: Partial<MaintenanceOffer['plans'][number]>) => {
    onChange({
      ...offer,
      plans: offer.plans.map((plan, current) => (current === index ? { ...plan, ...patch } : plan)),
    })
  }

  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">Mantenimiento</h2>
        <p className="text-muted-foreground text-[11px]">
          Personaliza los planes para esta propuesta. El cliente podrá escoger uno antes de
          aceptarla.
        </p>
      </header>
      <label className="border-border bg-muted/20 flex cursor-pointer items-start gap-3 rounded-lg border p-3">
        <input
          type="checkbox"
          checked={offer.enabled}
          disabled={locked}
          onChange={(event) => {
            onChange({ ...offer, enabled: event.target.checked })
            if (!event.target.checked) onSelectedPlanChange(null)
          }}
          aria-label="Incluir mantenimiento en esta propuesta"
          className="accent-primary mt-0.5 size-4"
        />
        <span>
          <span className="block text-sm font-medium">Incluir mantenimiento en esta propuesta</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            Desactívalo para propuestas puntuales sin cuota ni opciones de mantenimiento.
          </span>
        </span>
      </label>
      {offer.enabled ? (
        <>
          <div className="border-border bg-muted/20 grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="text-muted-foreground flex flex-col gap-1.5 text-xs font-medium">
              <span>Título para el cliente</span>
              <Input
                value={offer.heading}
                onChange={(event) => onChange({ ...offer, heading: event.target.value })}
                disabled={locked}
                aria-label="Título de mantenimiento"
                className="bg-background"
              />
            </div>
            <div className="text-muted-foreground flex flex-col gap-1.5 text-xs font-medium">
              <span>Mensaje de introducción</span>
              <Textarea
                value={offer.intro}
                onChange={(event) => onChange({ ...offer, intro: event.target.value })}
                disabled={locked}
                rows={2}
                aria-label="Introducción de mantenimiento"
                className="bg-background min-h-20 resize-y text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {offer.plans.map((plan, index) => {
              const selected = selectedPlanId === plan.id
              const recommended = recommendedPlanId === plan.id
              return (
                <article
                  key={plan.id}
                  className={`overflow-hidden rounded-xl border ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background'}`}
                >
                  <header className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-background text-muted-foreground flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums shadow-sm">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-foreground text-sm font-semibold">
                          Plan de mantenimiento
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          Personaliza la cuota y las condiciones incluidas.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                        <input
                          type="radio"
                          name="recommended-maintenance-plan"
                          checked={recommended}
                          onChange={() => onChange({ ...offer, recommended_plan_id: plan.id })}
                          disabled={locked}
                          aria-label={`Recomendar el plan ${plan.name}`}
                          className="accent-primary size-3.5"
                        />
                        Recomendado al cliente
                      </label>
                      {selected ? (
                        <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
                          <Check className="size-3.5" aria-hidden /> Seleccionado
                        </span>
                      ) : null}
                    </div>
                  </header>
                  <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                        <div className="text-muted-foreground flex flex-col gap-1.5 text-xs font-medium">
                          <span>Nombre del plan</span>
                          <Input
                            value={plan.name}
                            onChange={(event) => patchPlan(index, { name: event.target.value })}
                            disabled={locked}
                            aria-label={`Nombre del plan ${index + 1}`}
                            className="bg-background"
                          />
                        </div>
                        <div className="text-muted-foreground flex flex-col gap-1.5 text-xs font-medium">
                          <span>Cuota mensual</span>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={plan.monthly_price}
                              onChange={(event) =>
                                patchPlan(index, { monthly_price: Number(event.target.value) || 0 })
                              }
                              disabled={locked}
                              aria-label={`Precio mensual del plan ${plan.name}`}
                              className="bg-background"
                            />
                            <span className="text-muted-foreground shrink-0 text-xs">€</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-muted-foreground flex flex-1 flex-col gap-1.5 text-xs font-medium">
                        <span>Resumen para el cliente</span>
                        <Textarea
                          value={plan.summary}
                          onChange={(event) => patchPlan(index, { summary: event.target.value })}
                          disabled={locked}
                          rows={4}
                          aria-label={`Resumen del plan ${plan.name}`}
                          className="bg-background min-h-28 flex-1 resize-y text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <section className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <MaintenanceListTextarea
                          items={plan.coverage}
                          onChange={(coverage) => patchPlan(index, { coverage })}
                          disabled={locked}
                          maxItems={MAINTENANCE_LIMITS.maxCoverageItems}
                          label="Incluye"
                          ariaLabel={`Coberturas del plan ${plan.name}`}
                          placeholder="Un concepto por línea"
                          className="bg-background min-h-32 resize-y border-emerald-500/20 text-sm"
                        />
                      </section>
                      <section className="border-border bg-muted/20 text-muted-foreground flex flex-col gap-1.5 rounded-lg border p-3 text-xs font-medium">
                        <MaintenanceListTextarea
                          items={plan.exclusions}
                          onChange={(exclusions) => patchPlan(index, { exclusions })}
                          disabled={locked}
                          maxItems={MAINTENANCE_LIMITS.maxExclusionItems}
                          label="No incluye"
                          ariaLabel={`Exclusiones del plan ${plan.name}`}
                          placeholder="Una exclusión por línea"
                          className="bg-background min-h-32 resize-y text-sm"
                        />
                      </section>
                    </div>
                  </div>
                  <footer className="border-border bg-muted/20 flex justify-end border-t px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? 'secondary' : 'outline'}
                      className="w-full sm:w-auto"
                      disabled={locked}
                      onClick={() => onSelectedPlanChange(selected ? null : plan.id)}
                    >
                      {selected
                        ? 'Quitar de la propuesta'
                        : `Seleccionar · ${formatEUR(plan.monthly_price)}/mes`}
                    </Button>
                  </footer>
                </article>
              )
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            {selectedPlanId
              ? 'Este plan queda incluido como cuota mensual y se podrá cambiar hasta que la propuesta sea aceptada.'
              : 'No se ha seleccionado ningún plan. La propuesta seguirá siendo válida sin mantenimiento.'}
          </p>
        </>
      ) : null}
    </section>
  )
}
