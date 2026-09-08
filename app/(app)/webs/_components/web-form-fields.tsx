'use client'

import { useState } from 'react'

import { DateField } from '@/components/ui/date-field'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { HOSTING_PROVIDER_LABELS, HOSTING_PROVIDERS } from '@/lib/schemas/web-project'
import type { WebProjectDetail } from '@/lib/webs/types'

type Defaults = Partial<WebProjectDetail>

interface Props {
  clients: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; client_id: string }>
  defaults?: Defaults
  idPrefix?: string
  autoFocusName?: boolean
}

/**
 * Shared field block for web project create and edit forms.
 */
export function WebFormFields({
  clients,
  projects,
  defaults: d = {},
  idPrefix = 'web',
  autoFocusName = false,
}: Props) {
  const [projectId, setProjectId] = useState(d.project_id ?? '')
  const [clientId, setClientId] = useState(d.client_id ?? '')
  const [clientVisible, setClientVisible] = useState(
    d.project_id ? (d.is_client_visible ?? true) : false,
  )

  function selectProject(nextProjectId: string) {
    const project = projects.find((item) => item.id === nextProjectId)
    if (!project) {
      setProjectId('')
      setClientVisible(false)
      return
    }
    if (!projectId) setClientVisible(true)
    setProjectId(project.id)
    setClientId(project.client_id)
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Nombre" htmlFor={`${idPrefix}-name`} required>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={200}
            autoFocus={autoFocusName}
            defaultValue={d.name ?? ''}
            placeholder="Landing doscientos"
          />
        </FormRow>

        <FormRow label="URL" htmlFor={`${idPrefix}-url`} required hint="URL principal del sitio.">
          <Input
            id={`${idPrefix}-url`}
            name="url"
            type="url"
            required
            maxLength={2000}
            defaultValue={d.url ?? ''}
            placeholder="https://doscientos.es"
          />
        </FormRow>

        <FormRow label="Cliente" htmlFor={`${idPrefix}-client_id`}>
          <Select
            id={`${idPrefix}-client_id`}
            name="client_id"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          >
            <option value="">— Sin cliente (web propia) —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow
          label="Proyecto"
          htmlFor={`${idPrefix}-project_id`}
          hint="Opcional. Vincula esta web con un proyecto."
        >
          <Select
            id={`${idPrefix}-project_id`}
            name="project_id"
            value={projectId}
            onChange={(event) => selectProject(event.target.value)}
          >
            <option value="">— Sin proyecto —</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Hosting" htmlFor={`${idPrefix}-hosting_provider`}>
          <Select
            id={`${idPrefix}-hosting_provider`}
            name="hosting_provider"
            defaultValue={d.hosting_provider ?? ''}
          >
            <option value="">— Sin especificar —</option>
            {HOSTING_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {HOSTING_PROVIDER_LABELS[p]}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow
          label="URL del hosting"
          htmlFor={`${idPrefix}-hosting_url`}
          hint="Link al dashboard."
        >
          <Input
            id={`${idPrefix}-hosting_url`}
            name="hosting_url"
            type="url"
            maxLength={2000}
            defaultValue={d.hosting_url ?? ''}
            placeholder="https://vercel.com/doscientos/landing"
          />
        </FormRow>

        <FormRow label="Registrador de dominio" htmlFor={`${idPrefix}-domain_registrar`}>
          <Input
            id={`${idPrefix}-domain_registrar`}
            name="domain_registrar"
            maxLength={200}
            defaultValue={d.domain_registrar ?? ''}
            placeholder="Namecheap, GoDaddy…"
          />
        </FormRow>

        <FormRow label="Vence el dominio" htmlFor={`${idPrefix}-domain_expires_at`}>
          <DateField
            id={`${idPrefix}-domain_expires_at`}
            name="domain_expires_at"
            defaultValue={d.domain_expires_at ?? ''}
          />
        </FormRow>

        <FormRow label="Tech stack" htmlFor={`${idPrefix}-tech_stack`} hint="Separado por comas.">
          <Input
            id={`${idPrefix}-tech_stack`}
            name="tech_stack"
            maxLength={500}
            defaultValue={(d.tech_stack ?? []).join(', ')}
            placeholder="Next.js, Tailwind, Supabase"
          />
        </FormRow>
      </div>

      {projectId ? (
        <FormRow label="Portal del proyecto" htmlFor={`${idPrefix}-is_client_visible`}>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              id={`${idPrefix}-is_client_visible`}
              type="checkbox"
              name="is_client_visible"
              checked={clientVisible}
              onChange={(event) => setClientVisible(event.target.checked)}
              className="accent-primary h-4 w-4"
            />
            Mostrar esta web en el portal compartido con el cliente
          </label>
        </FormRow>
      ) : null}

      <FormRow label="¿Web propia?" htmlFor={`${idPrefix}-is_own`}>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-is_own`}
            type="checkbox"
            name="is_own"
            defaultChecked={d.is_own ?? false}
            className="accent-primary h-4 w-4"
          />
          Marcar como web de doscientos
        </label>
      </FormRow>

      <FormRow
        label="Slug de backups"
        htmlFor={`${idPrefix}-backup_slug`}
        hint="Nombre de carpeta en FileBrowser (ej: optinergia). Dejar vacío si no hay backups."
      >
        <Input
          id={`${idPrefix}-backup_slug`}
          name="backup_slug"
          maxLength={200}
          defaultValue={d.backup_slug ?? ''}
          placeholder="optinergia"
        />
      </FormRow>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-muted-foreground px-1 text-sm font-medium">Conexión a BD</legend>
        <p className="text-muted-foreground text-xs">
          Credenciales para backups automáticos. La contraseña se guarda cifrada (AES-256-GCM) y
          nunca se expone al navegador.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow label="Host" htmlFor={`${idPrefix}-db_host`}>
            <Input
              id={`${idPrefix}-db_host`}
              name="db_host"
              maxLength={255}
              defaultValue={d.db_host ?? ''}
              placeholder="127.0.0.1"
            />
          </FormRow>

          <FormRow label="Puerto" htmlFor={`${idPrefix}-db_port`}>
            <Input
              id={`${idPrefix}-db_port`}
              name="db_port"
              type="number"
              min={1}
              max={65535}
              defaultValue={d.db_port ?? ''}
              placeholder="5432"
            />
          </FormRow>

          <FormRow label="Base de datos" htmlFor={`${idPrefix}-db_name`}>
            <Input
              id={`${idPrefix}-db_name`}
              name="db_name"
              maxLength={255}
              defaultValue={d.db_name ?? ''}
              placeholder="optinergia_prod"
            />
          </FormRow>

          <FormRow label="Usuario" htmlFor={`${idPrefix}-db_user`}>
            <Input
              id={`${idPrefix}-db_user`}
              name="db_user"
              maxLength={255}
              defaultValue={d.db_user ?? ''}
              placeholder="postgres"
            />
          </FormRow>
        </div>

        <FormRow
          label="Contraseña"
          htmlFor={`${idPrefix}-db_pass`}
          hint={
            d.has_db_password
              ? 'Ya hay una contraseña guardada. Déjalo vacío para mantenerla.'
              : 'Se almacenará cifrada.'
          }
        >
          <Input
            id={`${idPrefix}-db_pass`}
            name="db_pass"
            type="password"
            maxLength={500}
            autoComplete="new-password"
            placeholder={d.has_db_password ? '••••••••' : ''}
          />
        </FormRow>
      </fieldset>

      <FormRow label="Notas" htmlFor={`${idPrefix}-notes`}>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={d.notes ?? ''}
          placeholder="Notas internas, accesos, consideraciones…"
        />
      </FormRow>
    </>
  )
}
