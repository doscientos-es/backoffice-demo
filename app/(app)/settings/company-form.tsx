'use client'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { IbanInput } from '@/components/ui/iban-input'
import { Input } from '@/components/ui/input'
import { NifInputOffline } from '@/components/ui/nif-input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { ZipInput } from '@/components/ui/zip-input'
import { COUNTRY_OPTIONS } from '@/lib/address'

import { updateCompanySettings } from './actions'

interface Props {
  companyName: string
  companyNif: string
  invoiceSeries: string
  defaultVatRate: number
  iban: string
  companyAddressStreet: string
  companyAddressZip: string
  companyAddressCity: string
  companyAddressProvince: string
  companyAddressCountry: string
  internalHourlyCost: number
  paymentTerms: string
}

export function CompanyForm({
  companyName,
  companyNif,
  invoiceSeries,
  defaultVatRate,
  iban,
  companyAddressStreet,
  companyAddressZip,
  companyAddressCity,
  companyAddressProvince,
  companyAddressCountry,
  internalHourlyCost,
  paymentTerms,
}: Props) {
  const feedback = useFormFeedback()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    feedback.setPending()
    const result = await updateCompanySettings(fd)
    if (result.ok) feedback.setSuccess('Empresa guardada')
    else feedback.setError(result.error)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="company_name" className="text-xs font-medium">
            Razón social <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="company_name"
            name="company_name"
            required
            defaultValue={companyName}
            placeholder="Mi Empresa S.L."
            autoComplete="organization"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="company_nif" className="text-xs font-medium">
            NIF / CIF
          </FieldLabel>
          <NifInputOffline id="company_nif" name="company_nif" defaultValue={companyNif} />
        </Field>
        <Field>
          <FieldLabel htmlFor="invoice_series" className="text-xs font-medium">
            Serie factura
          </FieldLabel>
          <Input
            id="invoice_series"
            name="invoice_series"
            maxLength={10}
            defaultValue={invoiceSeries}
            placeholder="A"
            aria-describedby="invoice-series-hint"
          />
          <FieldDescription id="invoice-series-hint">
            Prefijo del número de factura (ej. A, 2026, FAC).
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="default_vat_rate" className="text-xs font-medium">
            IVA por defecto (%)
          </FieldLabel>
          <Input
            id="default_vat_rate"
            name="default_vat_rate"
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            defaultValue={defaultVatRate}
            placeholder="21"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="internal_hourly_cost" className="text-xs font-medium">
            Coste interno por hora (€/h)
          </FieldLabel>
          <Input
            id="internal_hourly_cost"
            name="internal_hourly_cost"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={internalHourlyCost}
            placeholder="0"
            aria-describedby="internal-hourly-cost-hint"
          />
          <FieldDescription id="internal-hourly-cost-hint">
            Valora las horas registradas al calcular la rentabilidad de cada proyecto.
          </FieldDescription>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="iban" className="text-xs font-medium">
            IBAN
          </FieldLabel>
          <IbanInput id="iban" name="iban" defaultValue={iban} />
          <FieldDescription>
            Se incluye en las facturas para pagos por transferencia.
          </FieldDescription>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="payment_terms" className="text-xs font-medium">
            Términos de pago por defecto
          </FieldLabel>
          <Textarea
            id="payment_terms"
            name="payment_terms"
            rows={3}
            maxLength={4000}
            defaultValue={paymentTerms}
            placeholder="Pago mediante transferencia bancaria o pago online (tarjeta/Bizum). Vencimiento a 30 días desde la fecha de emisión."
            aria-describedby="payment-terms-hint"
          />
          <FieldDescription id="payment-terms-hint">
            Texto que aparece en la sección de pago de las facturas. Se puede sobrescribir en cada
            factura.
          </FieldDescription>
        </Field>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Dirección fiscal</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="company_address_street" className="text-xs font-medium">
              Calle y número
            </FieldLabel>
            <Input
              id="company_address_street"
              name="company_address_street"
              maxLength={200}
              defaultValue={companyAddressStreet}
              placeholder="Calle Mayor, 1 - 3ª"
              autoComplete="street-address"
            />
          </Field>
          <ZipInput
            namePrefix="company_address"
            defaultZip={companyAddressZip}
            defaultCity={companyAddressCity}
            defaultProvince={companyAddressProvince}
            country={companyAddressCountry || 'ES'}
          />
          <Field>
            <FieldLabel htmlFor="company_address_country" className="text-xs font-medium">
              País
            </FieldLabel>
            <Select
              id="company_address_country"
              name="company_address_country"
              defaultValue={companyAddressCountry || 'ES'}
              autoComplete="country"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <FieldDescription>Aparece en las facturas como dirección del emisor.</FieldDescription>
      </div>
      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <FormFeedback state={feedback.state} successLabel="Empresa guardada" />
        <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
          Guardar empresa
        </SubmitButton>
      </div>
    </form>
  )
}
