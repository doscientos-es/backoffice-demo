'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import type { CompanyGoals } from '@/lib/dashboard/types'

import { upsertCompanyGoals } from './actions'

export function GoalsForm({ goals }: { goals: CompanyGoals }) {
  const [leadsNew, setLeadsNew] = useState(
    goals.leads_new ? String(Math.round(goals.leads_new)) : '',
  )
  const [revenue, setRevenue] = useState(goals.revenue ? String(Math.round(goals.revenue)) : '')
  const [conversionRate, setConversionRate] = useState(
    goals.conversion_rate ? String(Math.round(goals.conversion_rate * 100)) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await upsertCompanyGoals({
        leadsNew: leadsNew ? Number(leadsNew) : null,
        revenue: revenue ? Number(revenue) : null,
        conversionRate: conversionRate ? Number(conversionRate) : null,
      })
      if (result.ok) {
        setSaved(true)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leads-new">Leads nuevos / mes</Label>
          <Input
            id="leads-new"
            type="number"
            min="1"
            step="1"
            placeholder="Ej. 20"
            value={leadsNew}
            onChange={(e) => setLeadsNew(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">Número de leads nuevos al mes</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="revenue">Facturación / mes (€)</Label>
          <Input
            id="revenue"
            type="number"
            min="1"
            step="100"
            placeholder="Ej. 10000"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">Objetivo de ingresos mensuales en EUR</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conversion-rate">Tasa de conversión (%)</Label>
          <Input
            id="conversion-rate"
            type="number"
            min="1"
            max="100"
            step="1"
            placeholder="Ej. 25"
            value={conversionRate}
            onChange={(e) => setConversionRate(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">% de leads que se convierten en clientes</p>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Deja un campo vacío para eliminar esa meta del dashboard.
      </p>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">Metas guardadas ✓</p>}

      <div className="flex gap-2">
        <SubmitButton loading={isPending} pendingLabel="Guardando…">
          Guardar metas
        </SubmitButton>
        {(leadsNew || revenue || conversionRate) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setLeadsNew('')
              setRevenue('')
              setConversionRate('')
            }}
          >
            Borrar todo
          </Button>
        )}
      </div>
    </form>
  )
}
