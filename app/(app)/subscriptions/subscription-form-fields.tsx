'use client'

import { useState } from 'react'

import { EntityCombobox } from '@/components/ui/entity-combobox'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SUBSCRIPTION_BILLING_CYCLE, SUBSCRIPTION_STATUS } from '@/lib/status'

type ClientOption = { id: string; name: string }
type ProjectOption = { id: string; name: string }

export type SubscriptionFormValues = {
  client_id: string
  project_id: string
  name: string
  description: string
  status: string
  billing_cycle: string
  amount: number
  vat_rate: number
  start_date: string
  end_date: string
  notes: string
}

type Props = {
  clients: ClientOption[]
  projects: ProjectOption[]
  /** Pass a full SubscriptionFormValues when editing; omit for create (defaults kick in). */
  defaults?: Partial<SubscriptionFormValues>
}

export function SubscriptionFormFields({ clients, projects, defaults }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [projectId, setProjectId] = useState(defaults?.project_id ?? '')

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormRow label="Nombre" htmlFor="sub-name" required className="sm:col-span-2">
        <Input
          id="sub-name"
          name="name"
          defaultValue={defaults?.name}
          placeholder="Mantenimiento web mensual"
          required
        />
      </FormRow>

      <FormRow label="Cliente" htmlFor="sub-client" required>
        <Select id="sub-client" name="client_id" defaultValue={defaults?.client_id} required>
          <option value="">— Selecciona cliente —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow label="Proyecto" htmlFor="sub-project">
        <EntityCombobox
          id="sub-project"
          name="project_id"
          items={projects.map((p) => ({ id: p.id, label: p.name }))}
          value={projectId}
          onChange={setProjectId}
          placeholder="Buscar proyecto…"
        />
      </FormRow>

      <FormRow label="Estado" htmlFor="sub-status">
        <Select id="sub-status" name="status" defaultValue={defaults?.status ?? 'active'}>
          {Object.entries(SUBSCRIPTION_STATUS).map(([v, m]) => (
            <option key={v} value={v}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow label="Ciclo de facturación" htmlFor="sub-billing">
        <Select
          id="sub-billing"
          name="billing_cycle"
          defaultValue={defaults?.billing_cycle ?? 'monthly'}
        >
          {Object.entries(SUBSCRIPTION_BILLING_CYCLE).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow label="Importe (€, sin IVA)" htmlFor="sub-amount" required>
        <Input
          id="sub-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaults?.amount}
          required
        />
      </FormRow>

      <FormRow label="IVA (%)" htmlFor="sub-vat">
        <Input
          id="sub-vat"
          name="vat_rate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={defaults?.vat_rate ?? 21}
        />
      </FormRow>

      <FormRow label="Inicio (primera factura)" htmlFor="sub-start" required>
        <Input
          id="sub-start"
          name="start_date"
          type="date"
          defaultValue={defaults?.start_date ?? today}
          required
        />
      </FormRow>

      <FormRow label="Fin (opcional)" htmlFor="sub-end">
        <Input id="sub-end" name="end_date" type="date" defaultValue={defaults?.end_date ?? ''} />
      </FormRow>

      <FormRow label="Descripción" htmlFor="sub-desc" className="sm:col-span-2">
        <Textarea id="sub-desc" name="description" defaultValue={defaults?.description} rows={2} />
      </FormRow>

      <FormRow label="Notas internas" htmlFor="sub-notes" className="sm:col-span-2">
        <Textarea
          id="sub-notes"
          name="notes"
          defaultValue={defaults?.notes}
          rows={3}
          placeholder="Notas visibles solo para el equipo…"
        />
      </FormRow>
    </div>
  )
}
