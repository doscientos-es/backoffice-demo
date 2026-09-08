import { DateField } from '@/components/ui/date-field'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { BillingSection, type ProjectBillingType } from './billing-section'
import type { GitHubSyncMode } from './github-sync-section'
import { GitHubSyncSection } from './github-sync-section'

export const PROJECT_STATUS_OPTIONS = [
  { value: 'planning', label: 'Planificación' },
  { value: 'active', label: 'Activo' },
  { value: 'on_hold', label: 'En pausa' },
  { value: 'done', label: 'Terminado' },
  { value: 'cancelled', label: 'Cancelado' },
] as const

export type ProjectFormDefaults = {
  client_id?: string | null
  name?: string | null
  status?: string | null
  starts_at?: string | null
  ends_at?: string | null
  description?: string | null
  billing_type?: ProjectBillingType | null
  hourly_rate?: number | null
  hourly_vat_rate?: number | null
  github_sync_mode?: GitHubSyncMode | null
  github_repo?: string | null
  github_installation_id?: number | null
  github_auto_sync?: boolean | null
}

interface Props {
  clients: Array<{ id: string; name: string }>
  defaults?: ProjectFormDefaults
  /** Avoids `id` collisions when create and edit forms coexist on the page. */
  idPrefix?: string
  /** Whether the client selector includes the disabled placeholder option. */
  showClientPlaceholder?: boolean
  autoFocusName?: boolean
  /**
   * Installation ID de la org, usado como fallback cuando el proyecto aún no
   * tiene uno propio. Permite prerellenar el campo de sync bidireccional.
   */
  orgDefaultInstallationId?: number | null
}

/**
 * Shared field block for the project create and edit forms. Keeps both flows
 * in sync so adding a column only requires touching one component.
 */
export function ProjectFormFields({
  clients,
  defaults,
  idPrefix = 'project',
  showClientPlaceholder = true,
  autoFocusName = false,
  orgDefaultInstallationId = null,
}: Props) {
  const d = defaults ?? {}
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow
          label="Cliente"
          htmlFor={`${idPrefix}-client_id`}
          required
          hint="Cliente al que pertenece el proyecto."
        >
          <Select
            id={`${idPrefix}-client_id`}
            name="client_id"
            required
            defaultValue={d.client_id ?? ''}
          >
            {showClientPlaceholder ? (
              <option value="" disabled>
                — Selecciona cliente —
              </option>
            ) : null}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Nombre del proyecto" htmlFor={`${idPrefix}-name`} required>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={160}
            autoFocus={autoFocusName}
            defaultValue={d.name ?? ''}
            placeholder="Rediseño web 2026"
          />
        </FormRow>
        <FormRow label="Estado" htmlFor={`${idPrefix}-status`} hint="Puedes cambiarlo más tarde.">
          <Select id={`${idPrefix}-status`} name="status" defaultValue={d.status ?? 'planning'}>
            {PROJECT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Inicio" htmlFor={`${idPrefix}-starts_at`}>
          <DateField
            id={`${idPrefix}-starts_at`}
            name="starts_at"
            defaultValue={d.starts_at ?? ''}
          />
        </FormRow>
        <FormRow label="Fin previsto" htmlFor={`${idPrefix}-ends_at`}>
          <DateField id={`${idPrefix}-ends_at`} name="ends_at" defaultValue={d.ends_at ?? ''} />
        </FormRow>
      </div>
      <FormRow
        label="Descripción"
        htmlFor={`${idPrefix}-description`}
        hint="Resumen del alcance del proyecto."
      >
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={d.description ?? ''}
          placeholder="Objetivos, entregables, criterios de aceptación…"
        />
      </FormRow>
      <BillingSection
        idPrefix={idPrefix}
        defaultBillingType={d.billing_type ?? 'fixed'}
        defaultHourlyRate={d.hourly_rate ?? null}
        defaultHourlyVatRate={d.hourly_vat_rate ?? null}
      />
      <GitHubSyncSection
        idPrefix={idPrefix}
        defaultMode={d.github_sync_mode ?? 'none'}
        defaultRepoUrl={d.github_repo ?? null}
        defaultInstallationId={d.github_installation_id ?? orgDefaultInstallationId ?? null}
        defaultAutoSync={d.github_auto_sync ?? true}
      />
    </>
  )
}
