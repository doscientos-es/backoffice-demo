'use client'

import { ChevronDown } from 'lucide-react'
import { useCallback, useState } from 'react'

import { ClientLogoUpload } from '@/components/ui/client-logo-upload'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ZipInput } from '@/components/ui/zip-input'
import { COUNTRY_OPTIONS } from '@/lib/address'

import { type ApplySelection, EnrichmentDialog } from './enrichment-dialog'
import { type AutofillData, NifInput } from './nif-input'

export type ClientFormDefaults = {
  name?: string | null
  label?: string | null
  nif?: string | null
  email?: string | null
  phone?: string | null
  contact_person?: string | null
  billing_address_street?: string | null
  billing_address_zip?: string | null
  billing_address_city?: string | null
  billing_address_province?: string | null
  billing_address_country?: string | null
  notes?: string | null
  logo_url?: string | null
}

/**
 * Shared field block for the client create and edit forms. Keeps both flows
 * in sync so adding a column only requires touching one component.
 *
 * When the NIF/CIF is verified and the company is found in the Registro
 * Mercantil, autofill pre-populates the name, city, and province fields.
 * The user can still edit all values manually.
 */
export function ClientFormFields({
  defaults,
  idPrefix = 'client',
  autoFocusName = false,
}: {
  defaults?: ClientFormDefaults
  idPrefix?: string
  autoFocusName?: boolean
}) {
  const d = defaults ?? {}
  const hasAdditionalDetails = Boolean(
    d.label ||
    d.contact_person ||
    d.billing_address_street ||
    d.billing_address_zip ||
    d.billing_address_city ||
    d.billing_address_province ||
    d.notes ||
    d.logo_url,
  )
  const [showDetails, setShowDetails] = useState(hasAdditionalDetails)

  // Controlled state for fields that can be autofilled from the Registro Mercantil
  const [name, setName] = useState(d.name ?? '')
  const [contactPerson, setContactPerson] = useState(d.contact_person ?? '')
  const [street, setStreet] = useState(d.billing_address_street ?? '')
  const [autofillCity, setAutofillCity] = useState(d.billing_address_city ?? '')
  const [autofillProvince, setAutofillProvince] = useState(d.billing_address_province ?? '')
  // Incrementing key forces ZipInput to remount with new defaults when autofill fires
  const [zipKey, setZipKey] = useState(0)

  // Enrichment dialog state
  const [enrichmentData, setEnrichmentData] = useState<AutofillData | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Called by NifInput when OpenMercantil returns company data → open dialog
  const handleAutofill = useCallback((data: AutofillData) => {
    setEnrichmentData(data)
    setDialogOpen(true)
  }, [])

  // Called by EnrichmentDialog when the user confirms selected fields
  const handleApply = useCallback((selection: ApplySelection) => {
    if (selection.name) setName(selection.name)
    if (selection.contactPerson) setContactPerson(selection.contactPerson)
    if (selection.address) setStreet(selection.address)
    if (selection.city || selection.province) {
      setAutofillCity(selection.city ?? '')
      setAutofillProvince(selection.province ?? '')
      setZipKey((k) => k + 1)
    }
  }, [])

  return (
    <>
      {/* Enrichment dialog — opens automatically after a successful RM lookup */}
      {enrichmentData && (
        <EnrichmentDialog
          open={dialogOpen}
          data={enrichmentData}
          onApplyAction={handleApply}
          onCloseAction={() => setDialogOpen(false)}
        />
      )}

      <p className="text-muted-foreground text-sm">
        Empieza por lo esencial. Podrás completar la ficha cuando tengas más información.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow
          label="Nombre"
          htmlFor={`${idPrefix}-name`}
          required
          hint="Razón social o nombre comercial."
        >
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={160}
            autoFocus={autoFocusName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme S.L."
            autoComplete="organization"
          />
        </FormRow>
        <FormRow
          label="NIF / CIF"
          htmlFor={`${idPrefix}-nif`}
          hint="Introduce el CIF y pulsa 'Verificar' para buscar en el Registro Mercantil."
        >
          <NifInput id={`${idPrefix}-nif`} defaultValue={d.nif} onAutofillAction={handleAutofill} />
        </FormRow>
        <FormRow label="Email" htmlFor={`${idPrefix}-email`}>
          <Input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            inputMode="email"
            maxLength={160}
            defaultValue={d.email ?? ''}
            placeholder="facturacion@acme.com"
            autoComplete="email"
          />
        </FormRow>
        <FormRow label="Teléfono" htmlFor={`${idPrefix}-phone`}>
          <Input
            id={`${idPrefix}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={40}
            defaultValue={d.phone ?? ''}
            placeholder="+34 600 000 000"
            autoComplete="tel"
          />
        </FormRow>
      </div>

      <div className="border-border border-t pt-3">
        <button
          type="button"
          onClick={() => setShowDetails((value) => !value)}
          aria-expanded={showDetails}
          aria-controls={`${idPrefix}-additional-details`}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronDown
            className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          />
          Más datos de cliente <span className="font-normal">(opcional)</span>
          {hasAdditionalDetails && !showDetails ? (
            <span className="bg-muted ml-auto rounded-full px-2 py-0.5 text-xs">con datos</span>
          ) : null}
        </button>
        <div
          id={`${idPrefix}-additional-details`}
          className={`mt-4 space-y-5 ${showDetails ? '' : 'hidden'}`}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <FormRow
              label="Alias / Label"
              htmlFor={`${idPrefix}-label`}
              hint="Nombre corto para listas. Si está vacío se usa la razón social."
            >
              <Input
                id={`${idPrefix}-label`}
                name="label"
                maxLength={100}
                defaultValue={d.label ?? ''}
                placeholder="Acme"
              />
            </FormRow>
            <FormRow label="Persona de contacto" htmlFor={`${idPrefix}-contact_person`}>
              <Input
                id={`${idPrefix}-contact_person`}
                name="contact_person"
                maxLength={160}
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Nombre y apellidos"
                autoComplete="name"
              />
            </FormRow>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Dirección de facturación</p>
            <p className="text-muted-foreground mb-3 text-xs">
              Se usará en las facturas cuando la necesites.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow
                label="Calle y número"
                htmlFor={`${idPrefix}-billing_address_street`}
                className="sm:col-span-2"
              >
                <Input
                  id={`${idPrefix}-billing_address_street`}
                  name="billing_address_street"
                  maxLength={200}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Calle Mayor, 1 - 3ª"
                  autoComplete="street-address"
                />
              </FormRow>
              <ZipInput
                key={zipKey}
                namePrefix="billing_address"
                defaultZip={d.billing_address_zip}
                defaultCity={autofillCity || d.billing_address_city}
                defaultProvince={autofillProvince || d.billing_address_province}
              />
              <FormRow label="País" htmlFor={`${idPrefix}-billing_address_country`}>
                <Select
                  id={`${idPrefix}-billing_address_country`}
                  name="billing_address_country"
                  defaultValue={d.billing_address_country ?? 'ES'}
                  autoComplete="country"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </FormRow>
            </div>
          </div>
          <FormRow
            label="Notas"
            htmlFor={`${idPrefix}-notes`}
            hint="Información interna, no visible para el cliente."
          >
            <Textarea
              id={`${idPrefix}-notes`}
              name="notes"
              rows={3}
              maxLength={4000}
              defaultValue={d.notes ?? ''}
              placeholder="Condiciones de pago, observaciones…"
            />
          </FormRow>
          <ClientLogoUpload defaultLogoUrl={d.logo_url} />
        </div>
      </div>
    </>
  )
}
