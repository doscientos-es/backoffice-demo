'use client'
import { useMemo, useState } from 'react'

import { DateField } from '@/components/ui/date-field'
import { EntityCombobox } from '@/components/ui/entity-combobox'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_FORM_DEFAULTS,
  EXPENSE_PAYMENT_SOURCE_LABELS,
  EXPENSE_PAYMENT_SOURCES,
  EXPENSE_RECURRENCE_LABELS,
  EXPENSE_RECURRENCES,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUSES,
} from '@/lib/finance'

export type VendorSuggestion = {
  vendor: string
  vendor_nif: string | null
  category: string
  payment_source: string
}

export type ExpenseFormDefaults = {
  vendor?: string
  description?: string | null
  category?: string
  status?: string
  recurrence?: string
  expense_date?: string
  due_date?: string | null
  paid_at?: string | null
  currency?: string
  subtotal?: number | string
  tax_rate?: number | string
  vendor_nif?: string | null
  invoice_reference?: string | null
  project_id?: string | null
  notes?: string | null
  payment_source?: string | null
  paid_by_member_id?: string | null
}

interface Props {
  defaults?: ExpenseFormDefaults
  /** Avoids `id` collisions when create and edit forms coexist on the page. */
  idPrefix?: string
  autoFocusVendor?: boolean
  projects?: Array<{ id: string; name: string; clientName?: string | null }>
  teamMembers?: Array<{ id: string; name: string }>
  /** Previously used vendors to power the vendor/NIF autocomplete. */
  vendorSuggestions?: VendorSuggestion[]
  onProjectIdChange?: () => void
}

/**
 * Shared field block for the expense create and edit forms. Server actions
 * own validation/computation (totals from subtotal + tax_rate).
 */
export function ExpenseFormFields({
  defaults,
  idPrefix = 'expense',
  autoFocusVendor = false,
  projects = [],
  teamMembers = [],
  vendorSuggestions = [],
  onProjectIdChange,
}: Props) {
  const d = defaults ?? {}
  const [paymentSource, setPaymentSource] = useState(
    d.payment_source ?? EXPENSE_FORM_DEFAULTS.payment_source,
  )
  const [vendor, setVendor] = useState(d.vendor ?? '')
  const [vendorNif, setVendorNif] = useState(d.vendor_nif ?? '')
  const [category, setCategory] = useState(d.category ?? EXPENSE_FORM_DEFAULTS.category)
  const [projectId, setProjectId] = useState(d.project_id ?? '')
  const [autofilled, setAutofilled] = useState(false)

  // Lookup of known vendors (case-insensitive) and the list of distinct NIFs
  // for the native <datalist> autocomplete.
  const vendorByName = useMemo(() => {
    const map = new Map<string, VendorSuggestion>()
    for (const s of vendorSuggestions) map.set(s.vendor.trim().toLowerCase(), s)
    return map
  }, [vendorSuggestions])

  const nifOptions = useMemo(
    () =>
      Array.from(
        new Set(
          vendorSuggestions.map((s) => s.vendor_nif?.trim()).filter((n): n is string => Boolean(n)),
        ),
      ),
    [vendorSuggestions],
  )

  /**
   * When the typed/picked vendor matches a previous one, pre-fill its fiscal
   * data without clobbering values the user already entered. Reveals the
   * optional details so the user can see what got filled.
   */
  function handleVendorChange(value: string) {
    setVendor(value)
    const match = vendorByName.get(value.trim().toLowerCase())
    if (!match) {
      setAutofilled(false)
      return
    }
    let didFill = false
    if (match.vendor_nif && !vendorNif.trim()) {
      setVendorNif(match.vendor_nif)
      didFill = true
    }
    if (didFill) {
      setCategory(match.category)
      setShowDetails(true)
    }
    setAutofilled(didFill)
  }
  const [showDetails, setShowDetails] = useState(
    !!(
      d.vendor_nif ||
      d.invoice_reference ||
      d.project_id ||
      d.description ||
      d.notes ||
      d.due_date ||
      d.paid_at ||
      d.recurrence !== 'none'
    ),
  )

  const hasOptionalValues = !!(
    d.vendor_nif ||
    d.invoice_reference ||
    d.project_id ||
    d.description ||
    d.notes
  )

  return (
    <>
      {/* ── Legend ── */}
      <p className="text-muted-foreground text-xs">
        Los campos marcados con <span className="text-destructive">*</span> son obligatorios. El
        resto tienen valores por defecto y puedes dejarlos como están.
      </p>

      {/* ── Required fields ── */}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow
          label="Proveedor"
          htmlFor={`${idPrefix}-vendor`}
          required
          hint={autofilled ? 'NIF y categoría rellenados desde un gasto anterior' : undefined}
        >
          <Input
            id={`${idPrefix}-vendor`}
            name="vendor"
            required
            maxLength={160}
            autoFocus={autoFocusVendor}
            placeholder="Meta, Notion, Google…"
            list={vendorSuggestions.length ? `${idPrefix}-vendor-options` : undefined}
            value={vendor}
            onChange={(e) => handleVendorChange(e.target.value)}
          />
          {vendorSuggestions.length > 0 && (
            <datalist id={`${idPrefix}-vendor-options`}>
              {vendorSuggestions.map((s) => (
                <option key={s.vendor} value={s.vendor} />
              ))}
            </datalist>
          )}
        </FormRow>
        <FormRow label="Fecha del gasto" htmlFor={`${idPrefix}-expense_date`} required>
          <DateField
            id={`${idPrefix}-expense_date`}
            name="expense_date"
            required
            defaultValue={d.expense_date ?? new Date().toISOString().slice(0, 10)}
          />
        </FormRow>
        <FormRow label="Subtotal (sin IVA)" htmlFor={`${idPrefix}-subtotal`} required>
          <Input
            id={`${idPrefix}-subtotal`}
            name="subtotal"
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
            defaultValue={(d.subtotal ?? EXPENSE_FORM_DEFAULTS.subtotal).toString()}
          />
        </FormRow>
        <FormRow label="Pagado desde" htmlFor={`${idPrefix}-payment_source`} required>
          <Select
            id={`${idPrefix}-payment_source`}
            name="payment_source"
            value={paymentSource}
            onChange={(e) => setPaymentSource(e.target.value)}
            required
          >
            {EXPENSE_PAYMENT_SOURCES.map((s) => (
              <option key={s} value={s}>
                {EXPENSE_PAYMENT_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormRow>
        {paymentSource === 'member' && (
          <FormRow
            label="Socio que pagó"
            htmlFor={`${idPrefix}-paid_by_member_id`}
            required
            className="sm:col-span-2"
          >
            <Select
              id={`${idPrefix}-paid_by_member_id`}
              name="paid_by_member_id"
              defaultValue={d.paid_by_member_id ?? ''}
              required
            >
              <option value="">— Selecciona —</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </FormRow>
        )}
        {paymentSource === 'company' && (
          /* hidden sentinel so the field is always submitted */
          <input type="hidden" name="paid_by_member_id" value="" />
        )}
      </div>

      {/* ── Defaults (optional, with sensible values) ── */}
      <div className="mt-2 grid gap-5 sm:grid-cols-3">
        <FormRow label="Categoría" htmlFor={`${idPrefix}-category`} hint="Por defecto: Servicio">
          <Select
            id={`${idPrefix}-category`}
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Estado" htmlFor={`${idPrefix}-status`} hint="Por defecto: Pagado">
          <Select
            id={`${idPrefix}-status`}
            name="status"
            defaultValue={d.status ?? EXPENSE_FORM_DEFAULTS.status}
          >
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EXPENSE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="IVA %" htmlFor={`${idPrefix}-tax_rate`} hint="Por defecto: 21 %">
          <Input
            id={`${idPrefix}-tax_rate`}
            name="tax_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            inputMode="decimal"
            defaultValue={(d.tax_rate ?? EXPENSE_FORM_DEFAULTS.tax_rate).toString()}
          />
        </FormRow>
      </div>

      {/* ── Optional details ── */}
      <div className="mt-4 border-t pt-3">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium"
          onClick={() => setShowDetails((v) => !v)}
        >
          <span>{showDetails ? '▾' : '▸'}</span>
          Más detalles (opcional)
          {hasOptionalValues && !showDetails && (
            <span className="bg-muted ml-1 rounded px-1.5 py-0.5 text-xs">con datos</span>
          )}
        </button>
        {/*
          Always mounted, only hidden via CSS when collapsed. Conditionally
          rendering (mount/unmount) would drop these names from FormData, and on
          edit the server action would overwrite the existing columns with null,
          silently wiping data the user never touched.
        */}
        <div className={`mt-4 grid gap-5 sm:grid-cols-2 ${showDetails ? '' : 'hidden'}`}>
          <FormRow label="Vencimiento" htmlFor={`${idPrefix}-due_date`}>
            <DateField
              id={`${idPrefix}-due_date`}
              name="due_date"
              defaultValue={d.due_date ?? ''}
            />
          </FormRow>
          <FormRow label="Fecha de pago" htmlFor={`${idPrefix}-paid_at`}>
            <DateField id={`${idPrefix}-paid_at`} name="paid_at" defaultValue={d.paid_at ?? ''} />
          </FormRow>
          <FormRow label="Recurrencia" htmlFor={`${idPrefix}-recurrence`}>
            <Select
              id={`${idPrefix}-recurrence`}
              name="recurrence"
              defaultValue={d.recurrence ?? EXPENSE_FORM_DEFAULTS.recurrence}
            >
              {EXPENSE_RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {EXPENSE_RECURRENCE_LABELS[r]}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="NIF proveedor" htmlFor={`${idPrefix}-vendor_nif`}>
            <Input
              id={`${idPrefix}-vendor_nif`}
              name="vendor_nif"
              maxLength={20}
              placeholder="ESBxxxxxxxx"
              list={nifOptions.length ? `${idPrefix}-nif-options` : undefined}
              value={vendorNif}
              onChange={(e) => setVendorNif(e.target.value)}
            />
            {nifOptions.length > 0 && (
              <datalist id={`${idPrefix}-nif-options`}>
                {nifOptions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            )}
          </FormRow>
          <FormRow label="Nº factura proveedor" htmlFor={`${idPrefix}-invoice_reference`}>
            <Input
              id={`${idPrefix}-invoice_reference`}
              name="invoice_reference"
              maxLength={80}
              defaultValue={d.invoice_reference ?? ''}
            />
          </FormRow>
          <FormRow label="Proyecto" htmlFor={`${idPrefix}-project_id`}>
            <EntityCombobox
              id={`${idPrefix}-project_id`}
              name="project_id"
              items={projects.map((p) => ({
                id: p.id,
                label: p.name,
                sublabel: p.clientName,
              }))}
              value={projectId}
              onChange={(id) => {
                setProjectId(id)
                onProjectIdChange?.()
              }}
              placeholder="Buscar proyecto…"
            />
          </FormRow>
          <FormRow label="Moneda" htmlFor={`${idPrefix}-currency`} className="sm:col-span-1">
            <Input
              id={`${idPrefix}-currency`}
              name="currency"
              maxLength={3}
              defaultValue={d.currency ?? EXPENSE_FORM_DEFAULTS.currency}
            />
          </FormRow>
          <div className="sm:col-span-2">
            <FormRow label="Descripción" htmlFor={`${idPrefix}-description`}>
              <Input
                id={`${idPrefix}-description`}
                name="description"
                maxLength={400}
                placeholder="Hosting mensual, dominio anual…"
                defaultValue={d.description ?? ''}
              />
            </FormRow>
          </div>
          <div className="sm:col-span-2">
            <FormRow label="Notas" htmlFor={`${idPrefix}-notes`}>
              <Textarea
                id={`${idPrefix}-notes`}
                name="notes"
                rows={3}
                maxLength={4000}
                defaultValue={d.notes ?? ''}
              />
            </FormRow>
          </div>
        </div>
      </div>
    </>
  )
}
