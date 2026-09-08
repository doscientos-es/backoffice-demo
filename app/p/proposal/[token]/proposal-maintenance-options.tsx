'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { type MaintenanceOffer, recommendedMaintenancePlanId } from '@/lib/proposals/maintenance'
import { formatEUR } from '@/lib/utils'

import { selectProposalMaintenance } from './actions'

export function ProposalMaintenanceOptions({
  token,
  offer,
  selectedPlanId,
  disabled,
}: {
  token: string
  offer: MaintenanceOffer
  selectedPlanId: string | null
  disabled: boolean
}) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 0 })
  const [selected, setSelected] = useState(selectedPlanId)
  const selectedPlan = offer.plans.find((plan) => plan.id === selected) ?? null
  const recommendedPlanId = recommendedMaintenancePlanId(offer)

  const choose = async (planId: string | null) => {
    if (disabled) return
    feedback.setPending()
    const result = await selectProposalMaintenance(token, planId)
    if (!result.ok) return feedback.setError(result.error)
    setSelected(planId)
    feedback.setSuccess(planId ? 'Mantenimiento seleccionado' : 'Mantenimiento no añadido')
    router.refresh()
  }

  return (
    <section className="border-t border-zinc-100 bg-[#2A4227]/3 px-6 py-7 sm:px-8 dark:border-zinc-800/60 dark:bg-[#9CC196]/4">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold tracking-widest text-[#2A4227] uppercase dark:text-[#9CC196]">
          {offer.heading}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Elige la cobertura que prefieras
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{offer.intro}</p>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Compara qué cubre cada plan y selecciona como máximo uno antes de confirmar la propuesta.
        </p>
      </header>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {offer.plans.map((plan) => {
          const active = selected === plan.id
          const recommended = recommendedPlanId === plan.id
          return (
            <article
              key={plan.id}
              className={`rounded-lg border p-4 ${active ? 'border-[#2A4227] bg-[#2A4227]/5 dark:border-[#9CC196]' : recommended ? 'border-[#2A4227]/50 bg-[#2A4227]/3 dark:border-[#9CC196]/60 dark:bg-[#9CC196]/5' : 'border-zinc-200 dark:border-zinc-800'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</h2>
                  <p className="mt-1 text-lg font-bold text-[#2A4227] dark:text-[#9CC196]">
                    {formatEUR(plan.monthly_price)}{' '}
                    <span className="text-xs font-medium">/ mes + IVA</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {recommended ? (
                    <span className="rounded-full bg-[#2A4227] px-2 py-1 text-[10px] font-semibold tracking-wide text-white uppercase dark:bg-[#9CC196] dark:text-[#1a2b18]">
                      Recomendado
                    </span>
                  ) : null}
                  {active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2A4227] dark:text-[#9CC196]">
                      <Check className="size-4" aria-hidden /> Seleccionado
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{plan.summary}</p>
              <p className="mt-4 text-[11px] font-semibold tracking-wide text-[#2A4227] uppercase dark:text-[#9CC196]">
                Incluye
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                {plan.coverage.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {plan.exclusions.length > 0 ? (
                <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
                  <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                    No incluye
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {plan.exclusions.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden>—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!disabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant={active ? 'secondary' : 'outline'}
                  className="mt-4 w-full"
                  disabled={feedback.pending}
                  onClick={() => choose(active ? null : plan.id)}
                >
                  {active ? 'Plan seleccionado · Quitar' : 'Elegir este plan'}
                </Button>
              ) : null}
            </article>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {selectedPlan ? (
          <p className="text-xs font-medium text-[#2A4227] dark:text-[#9CC196]">
            Has elegido {selectedPlan.name}. Puedes cambiarlo o quitarlo antes de confirmar.
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Puedes confirmar la propuesta sin añadir mantenimiento.
          </p>
        )}
        {!disabled ? (
          <FormFeedback state={feedback.state} pendingLabel="Actualizando propuesta…" />
        ) : null}
      </div>
    </section>
  )
}
