'use client'

import { type ReactNode, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export type ProjectBillingType = 'fixed' | 'hourly'

export interface BillingSectionProps {
  idPrefix: string
  defaultBillingType?: ProjectBillingType
  defaultHourlyRate?: number | null
  defaultHourlyVatRate?: number | null
}

/**
 * Billing model selector for the project create/edit forms. Most projects are
 * fixed-price; choosing "Por horas" reveals the €/h rate and its VAT, which
 * drive the monthly invoice generated from logged hours (e.g. Palumba: 40 €/h,
 * sin impuestos).
 */
export function BillingSection({
  idPrefix,
  defaultBillingType = 'fixed',
  defaultHourlyRate,
  defaultHourlyVatRate,
}: BillingSectionProps) {
  const [billingType, setBillingType] = useState<ProjectBillingType>(defaultBillingType)
  const isHourly = billingType === 'hourly'

  return (
    <fieldset className="border-border bg-muted/20 flex flex-col gap-3 rounded-lg border p-4">
      <legend className="text-muted-foreground px-1 text-xs font-semibold tracking-wide uppercase">
        Facturación
      </legend>

      <Field label="Modelo de facturación" htmlFor={`${idPrefix}-billing_type`}>
        <Select
          id={`${idPrefix}-billing_type`}
          name="billing_type"
          value={billingType}
          onChange={(e) => setBillingType(e.target.value as ProjectBillingType)}
        >
          <option value="fixed">Precio cerrado</option>
          <option value="hourly">Por horas registradas</option>
        </Select>
      </Field>

      {isHourly ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Tarifa por hora (€)"
            htmlFor={`${idPrefix}-hourly_rate`}
            hint="Se aplica al generar la factura mensual a partir de las horas registradas."
            required
          >
            <Input
              id={`${idPrefix}-hourly_rate`}
              name="hourly_rate"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              defaultValue={defaultHourlyRate ?? ''}
              placeholder="40"
              className="text-right tabular-nums"
            />
          </Field>
          <Field
            label="IVA (%)"
            htmlFor={`${idPrefix}-hourly_vat_rate`}
            hint="0 para proyectos sin impuestos."
          >
            <Input
              id={`${idPrefix}-hourly_vat_rate`}
              name="hourly_vat_rate"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              defaultValue={defaultHourlyVatRate ?? 21}
              className="text-right tabular-nums"
            />
          </Field>
        </div>
      ) : (
        // Keep the fields present so the edit dialog's FormData always carries a
        // value; the server zeroes them out for fixed-price projects anyway.
        <>
          <input type="hidden" name="hourly_rate" value="" />
          <input type="hidden" name="hourly_vat_rate" value="21" />
        </>
      )}
    </fieldset>
  )
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase"
      >
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-muted-foreground text-[11px]">{hint}</p> : null}
    </div>
  )
}
