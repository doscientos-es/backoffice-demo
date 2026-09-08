'use client'

import { Plus } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import type { TaskPriorityType, TaskStatusType } from '@/lib/schemas/task'

import { createTask } from './actions'
import { TaskFormFields } from './task-form-fields'

interface Props {
  /** Pre-fills `project_id`. Renders as a hidden input so parent stays fixed. */
  projectId?: string
  /** Pre-fills `lead_id`. Renders as a hidden input so parent stays fixed. */
  leadId?: string
  /** Pre-fills `client_id`. Renders as a hidden input so context stays fixed. */
  clientId?: string
  projects?: Array<{ id: string; name: string }>
  leads?: Array<{ id: string; name: string }>
  clients?: Array<{ id: string; name: string }>
  members?: Array<{ id: string; name: string }>
  /** Pre-selects the assignee. Defaults to the current user when provided. */
  currentUserId?: string
  /** Custom trigger. Falls back to a primary button labelled "Nueva tarea". */
  trigger?: ReactNode
  /** Controlled visibility, for flows that open the dialog after another action. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Optional callback fired after a successful creation (e.g. router refresh). */
  onCreated?: (id: string) => void
}

/**
 * In-context task creation dialog. Mirrors `TaskEditDialog` but invokes
 * `createTask` and reuses the same `TaskFormFields` block. The form is reset
 * after each successful submission so the dialog can be reused without
 * remounting.
 */
export function TaskCreateDialog({
  projectId,
  leadId,
  clientId,
  projects = [],
  leads = [],
  clients = [],
  members = [],
  currentUserId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const feedback = useFormFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const fd = new FormData(e.currentTarget)
    const res = await createTask({
      title: fd.get('title')?.toString() ?? '',
      description: fd.get('description')?.toString() ?? '',
      client_title: fd.get('client_title')?.toString() ?? '',
      client_summary: fd.get('client_summary')?.toString() ?? '',
      project_id: projectId ?? fd.get('project_id')?.toString() ?? '',
      lead_id: leadId ?? fd.get('lead_id')?.toString() ?? '',
      client_id: clientId ?? fd.get('client_id')?.toString() ?? '',
      member_ids: fd
        .getAll('member_ids')
        .map((v) => v.toString())
        .filter(Boolean),
      status: (fd.get('status')?.toString() ?? 'todo') as TaskStatusType,
      priority: (fd.get('priority')?.toString() ?? 'medium') as TaskPriorityType,
      due_date: fd.get('due_date')?.toString() ?? '',
      is_client_visible: fd.get('is_client_visible') === 'on',
    })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Tarea creada')
    formRef.current?.reset()
    onCreated?.(res.id)
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) feedback.reset()
      }}
    >
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" aria-hidden />
            Nueva tarea
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear tarea</DialogTitle>
          <DialogDescription>
            Puedes crear una tarea personal y asociarla opcionalmente a un proyecto, lead o cliente.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={onSubmit} className="flex max-h-[70vh] flex-col">
          <div className="scroll-fade no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
            {leadId ? <input type="hidden" name="lead_id" value={leadId} /> : null}
            {clientId ? <input type="hidden" name="client_id" value={clientId} /> : null}
            <TaskFormFields
              idPrefix="create"
              autoFocusTitle
              includeParentSelectors={!projectId && !leadId && !clientId}
              projects={projects}
              leads={leads}
              clients={clients}
              members={members}
              defaults={{
                status: 'todo',
                priority: 'medium',
                member_ids: currentUserId ? [currentUserId] : [],
                project_id: projectId,
              }}
            />
          </div>
          <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Creando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
              Crear tarea
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
