'use client'

import { useState } from 'react'

import { DateField } from '@/components/ui/date-field'
import { EntityCombobox } from '@/components/ui/entity-combobox'
import { EntityMultiCombobox } from '@/components/ui/entity-multi-combobox'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export const TASK_STATUS_OPTIONS = [
  { value: 'todo', label: 'Por hacer' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'in_review', label: 'Revisión' },
  { value: 'done', label: 'Terminada' },
  { value: 'cancelled', label: 'Cancelada' },
] as const

export const TASK_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
] as const

export type TaskFormDefaults = {
  title?: string
  description?: string | null
  client_title?: string | null
  client_summary?: string | null
  project_id?: string | null
  lead_id?: string | null
  client_id?: string | null
  /** Pre-selected member IDs. Replaces the legacy single assignee_id. */
  member_ids?: string[]
  status?: string | null
  priority?: string | null
  due_date?: string | null
  is_client_visible?: boolean
}

interface Props {
  defaults?: TaskFormDefaults
  /** Avoids `id` collisions when create and edit forms coexist on the page. */
  idPrefix?: string
  autoFocusTitle?: boolean
  /** Show project, lead and client selectors (create-only). Edit keeps context fixed. */
  includeParentSelectors?: boolean
  /** Notifies dirty-form tracking when the custom member picker changes. */
  onMemberIdsChange?: () => void
  projects?: Array<{ id: string; name: string }>
  leads?: Array<{ id: string; name: string }>
  clients?: Array<{ id: string; name: string }>
  members?: Array<{ id: string; name: string }>
}

/**
 * Shared field block for the task create and edit forms. Parent selectors
 * (project / lead) only render on create — edit keeps the parent fixed.
 */
export function TaskFormFields({
  defaults,
  idPrefix = 'task',
  autoFocusTitle = false,
  includeParentSelectors = false,
  onMemberIdsChange,
  projects = [],
  leads = [],
  clients = [],
  members = [],
}: Props) {
  const d = defaults ?? {}
  const [projectId, setProjectId] = useState(d.project_id ?? '')
  const [leadId, setLeadId] = useState(d.lead_id ?? '')
  const [clientId, setClientId] = useState(d.client_id ?? '')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(d.member_ids ?? [])

  return (
    <>
      <FormRow label="Título" htmlFor={`${idPrefix}-title`} required>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          required
          maxLength={200}
          autoFocus={autoFocusTitle}
          defaultValue={d.title ?? ''}
        />
      </FormRow>
      <FormRow label="Descripción" htmlFor={`${idPrefix}-description`}>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={3}
          maxLength={8000}
          defaultValue={d.description ?? ''}
        />
      </FormRow>
      <div className="border-border/70 rounded-md border p-4">
        <p className="text-sm font-medium">Contenido para cliente</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Opcional. Solo se muestra en el portal cuando la tarea es visible; si el título queda
          vacío, se usará el título interno.
        </p>
        <div className="mt-4 grid gap-4">
          <FormRow label="Título para cliente" htmlFor={`${idPrefix}-client_title`}>
            <Input
              id={`${idPrefix}-client_title`}
              name="client_title"
              maxLength={200}
              defaultValue={d.client_title ?? ''}
            />
          </FormRow>
          <FormRow label="Resumen para cliente" htmlFor={`${idPrefix}-client_summary`}>
            <Textarea
              id={`${idPrefix}-client_summary`}
              name="client_summary"
              rows={2}
              maxLength={8000}
              defaultValue={d.client_summary ?? ''}
            />
          </FormRow>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {includeParentSelectors ? (
          <>
            <FormRow label="Proyecto" htmlFor={`${idPrefix}-project_id`}>
              <EntityCombobox
                id={`${idPrefix}-project_id`}
                name="project_id"
                items={projects.map((p) => ({ id: p.id, label: p.name }))}
                value={projectId}
                onChange={setProjectId}
                placeholder="Buscar proyecto…"
              />
            </FormRow>
            <FormRow label="Lead" htmlFor={`${idPrefix}-lead_id`}>
              <EntityCombobox
                id={`${idPrefix}-lead_id`}
                name="lead_id"
                items={leads.map((l) => ({ id: l.id, label: l.name }))}
                value={leadId}
                onChange={setLeadId}
                placeholder="Buscar lead…"
              />
            </FormRow>
            <FormRow label="Cliente" htmlFor={`${idPrefix}-client_id`}>
              <EntityCombobox
                id={`${idPrefix}-client_id`}
                name="client_id"
                items={clients.map((c) => ({ id: c.id, label: c.name }))}
                value={clientId}
                onChange={setClientId}
                placeholder="Buscar cliente…"
              />
            </FormRow>
          </>
        ) : null}
        <FormRow label="Asignada a" htmlFor={`${idPrefix}-member_ids`}>
          {/* Hidden inputs carry selected IDs for FormData / fd.getAll("member_ids") */}
          {selectedMemberIds.map((mid) => (
            <input key={mid} type="hidden" name="member_ids" value={mid} />
          ))}
          <EntityMultiCombobox
            id={`${idPrefix}-member_ids`}
            items={members.map((m) => ({ id: m.id, label: m.name }))}
            value={selectedMemberIds}
            onChange={(ids) => {
              setSelectedMemberIds(ids)
              onMemberIdsChange?.()
            }}
            placeholder="Asignar miembros…"
          />
        </FormRow>
        <FormRow label="Estado" htmlFor={`${idPrefix}-status`}>
          <Select id={`${idPrefix}-status`} name="status" defaultValue={d.status ?? 'todo'}>
            {TASK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Prioridad" htmlFor={`${idPrefix}-priority`}>
          <Select id={`${idPrefix}-priority`} name="priority" defaultValue={d.priority ?? 'medium'}>
            {TASK_PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Vencimiento" htmlFor={`${idPrefix}-due_date`}>
          <DateField id={`${idPrefix}-due_date`} name="due_date" defaultValue={d.due_date ?? ''} />
        </FormRow>
      </div>
      <label className="border-border/70 flex items-start gap-2 rounded-md border p-3 text-sm">
        <input
          type="checkbox"
          name="is_client_visible"
          defaultChecked={d.is_client_visible ?? true}
          className="accent-primary mt-0.5 size-4"
        />
        <span>
          <span className="block font-medium">Visible en el portal del cliente</span>
          <span className="text-muted-foreground block text-xs">
            Se compartirán el título y resumen para cliente si los indicas; si no, se usará el
            título normal. La descripción interna y los comentarios seguirán siendo privados.
          </span>
        </span>
      </label>
    </>
  )
}
