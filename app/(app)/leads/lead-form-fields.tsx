import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { MemberOption } from '@/lib/members/queries'

export const SOLUTION_TYPES = [
  'Software a medida',
  'App móvil',
  'Web corporativa',
  'E-commerce',
  'Consultoría técnica',
  'Otro',
] as const

export const LEAD_SOURCES = [
  'Landing',
  'Anuncios Meta',
  'Cal.com',
  'Referencia',
  'Conocido',
  'LinkedIn',
  'Email',
  'Evento',
  'Otro',
] as const

export type LeadFormDefaults = {
  name?: string
  /** Optional short display name. Falls back to `name` when empty. */
  alias?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  notes?: string | null
  estimated_value?: number | null
  company_size?: string | null
  solution_type?: string | null
  urgency?: string | null
  assigned_to?: string | null
}

/**
 * Shared lead form fields used by the create page and the edit dialog.
 * `idPrefix` avoids `id` collisions when multiple forms coexist on the page.
 * `includeEstimatedValue` toggles the estimated value field (edit only for now).
 */
export function LeadFormFields({
  defaults,
  idPrefix = 'lead',
  includeEstimatedValue = false,
  autoFocusName = false,
  members = [],
}: {
  defaults?: LeadFormDefaults
  idPrefix?: string
  includeEstimatedValue?: boolean
  autoFocusName?: boolean
  members?: MemberOption[]
}) {
  const d = defaults ?? {}
  const sourceValue = d.source ?? ''
  const isCustomSource = sourceValue !== '' && !LEAD_SOURCES.includes(sourceValue as never)
  const solutionValue = d.solution_type ?? ''
  const isCustomSolution = solutionValue !== '' && !SOLUTION_TYPES.includes(solutionValue as never)
  return (
    <div className="flex flex-col gap-6">
      {/* ── Contacto ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Contacto
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow label="Nombre" htmlFor={`${idPrefix}-name`} required>
            <Input
              id={`${idPrefix}-name`}
              name="name"
              required
              maxLength={160}
              autoFocus={autoFocusName}
              defaultValue={d.name ?? ''}
              placeholder="Nombre y apellidos"
              autoComplete="name"
            />
          </FormRow>
          <FormRow
            label="Alias / Apodo"
            htmlFor={`${idPrefix}-alias`}
            hint="Nombre corto para listas. Si está vacío se usa el nombre."
          >
            <Input
              id={`${idPrefix}-alias`}
              name="alias"
              maxLength={100}
              defaultValue={d.alias ?? ''}
              placeholder="Pepito"
            />
          </FormRow>
          <FormRow label="Empresa" htmlFor={`${idPrefix}-company`}>
            <Input
              id={`${idPrefix}-company`}
              name="company"
              maxLength={160}
              defaultValue={d.company ?? ''}
              placeholder="Acme S.L."
              autoComplete="organization"
            />
          </FormRow>
          <FormRow label="Email" htmlFor={`${idPrefix}-email`}>
            <Input
              id={`${idPrefix}-email`}
              name="email"
              type="email"
              inputMode="email"
              maxLength={160}
              defaultValue={d.email ?? ''}
              placeholder="nombre@empresa.com"
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
      </section>

      {/* ── Proyecto ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Proyecto
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow
            label="Tipo de solución"
            htmlFor={`${idPrefix}-solution_type`}
            hint="Qué quiere desarrollar el cliente."
            className="sm:col-span-2"
          >
            <Select
              id={`${idPrefix}-solution_type`}
              name="solution_type"
              defaultValue={isCustomSolution ? 'Otro' : solutionValue}
            >
              <option value="">— Sin especificar —</option>
              {SOLUTION_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormRow>
          {includeEstimatedValue ? (
            <FormRow
              label="Valor estimado (€)"
              htmlFor={`${idPrefix}-estimated_value`}
              hint="Importe aproximado del proyecto."
            >
              <Input
                id={`${idPrefix}-estimated_value`}
                name="estimated_value"
                type="number"
                inputMode="decimal"
                min={0}
                max={99999999.99}
                step="0.01"
                defaultValue={d.estimated_value != null ? String(d.estimated_value) : ''}
                placeholder="0.00"
              />
            </FormRow>
          ) : null}
          <FormRow
            label="Urgencia"
            htmlFor={`${idPrefix}-urgency`}
            hint="Cuándo necesitan empezar."
          >
            <Select id={`${idPrefix}-urgency`} name="urgency" defaultValue={d.urgency ?? ''}>
              <option value="">— Sin especificar —</option>
              <option value="Inmediata">Inmediata</option>
              <option value="Este mes">Este mes</option>
              <option value="Este trimestre">Este trimestre</option>
              <option value="Sin urgencia">Sin urgencia</option>
            </Select>
          </FormRow>
          <FormRow
            label="Tamaño de empresa"
            htmlFor={`${idPrefix}-company_size`}
            hint="Número de empleados del cliente."
          >
            <Select
              id={`${idPrefix}-company_size`}
              name="company_size"
              defaultValue={d.company_size ?? ''}
            >
              <option value="">— Sin especificar —</option>
              <option value="1-10 empleados">1–10 empleados</option>
              <option value="10-50 empleados">10–50 empleados</option>
              <option value="50-200 empleados">50–200 empleados</option>
              <option value="Más de 200 empleados">+200 empleados</option>
            </Select>
          </FormRow>
        </div>
      </section>

      {/* ── Gestión ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Gestión
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow
            label="Origen"
            htmlFor={`${idPrefix}-source`}
            hint="Canal por el que llegó el lead."
          >
            <Select
              id={`${idPrefix}-source`}
              name="source"
              defaultValue={isCustomSource ? 'Otro' : sourceValue}
            >
              <option value="">— Sin especificar —</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormRow>
          {members.length > 0 && (
            <FormRow
              label="Responsable"
              htmlFor={`${idPrefix}-assigned_to`}
              hint="Miembro del equipo que gestiona este lead."
            >
              <Select
                id={`${idPrefix}-assigned_to`}
                name="assigned_to"
                defaultValue={d.assigned_to ?? ''}
              >
                <option value="">— Sin asignar —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </FormRow>
          )}
        </div>
      </section>

      {/* ── Notas ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Notas
        </p>
        <FormRow
          label="Notas internas"
          htmlFor={`${idPrefix}-notes`}
          hint="Contexto, necesidades detectadas, próximos pasos…"
        >
          <Textarea
            id={`${idPrefix}-notes`}
            name="notes"
            rows={4}
            maxLength={4000}
            className="resize-y"
            defaultValue={d.notes ?? ''}
            placeholder="Reunión inicial el 14/03 — interesados en módulo de facturación…"
          />
        </FormRow>
      </section>
    </div>
  )
}
