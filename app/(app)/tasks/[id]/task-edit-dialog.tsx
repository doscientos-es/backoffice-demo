'use client'

import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
import { VersionConflictDialog } from '@/components/ui/version-conflict-dialog'
import { useFormDirty } from '@/lib/hooks/use-form-dirty'
import type { TaskPriorityType, TaskStatusType } from '@/lib/schemas/task'

import { updateTask } from '../actions'
import { TaskFormFields } from '../task-form-fields'

type Task = {
  id: string
  title: string
  description: string | null
  client_title: string | null
  client_summary: string | null
  status: string
  priority: string
  member_ids: string[]
  due_date: string | null
  is_client_visible: boolean
  version: number
}

interface Props {
  task: Task
  members: Array<{ id: string; name: string }>
}

export function TaskEditDialog({ task, members }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const feedback = useFormFeedback()
  const { formRef, isDirty, reset, markDirty } = useFormDirty<HTMLFormElement>()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const fd = new FormData(e.currentTarget)
    const res = await updateTask({
      id: task.id,
      expected_version: task.version,
      title: fd.get('title')?.toString() ?? '',
      description: fd.get('description')?.toString() ?? '',
      client_title: fd.get('client_title')?.toString() ?? '',
      client_summary: fd.get('client_summary')?.toString() ?? '',
      member_ids: fd
        .getAll('member_ids')
        .map((v) => v.toString())
        .filter(Boolean),
      status: (fd.get('status')?.toString() ?? 'todo') as TaskStatusType,
      priority: (fd.get('priority')?.toString() ?? 'medium') as TaskPriorityType,
      due_date: fd.get('due_date')?.toString() ?? '',
      is_client_visible: fd.get('is_client_visible') === 'on',
    })
    if (!res.ok) {
      if (res.code === 'conflict') setConflictOpen(true)
      else feedback.setError(res.error)
      return
    }
    feedback.setSuccess('Guardado')
    reset()
    setTimeout(() => {
      setOpen(false)
      router.refresh()
    }, 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) feedback.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar tarea</DialogTitle>
          <DialogDescription>Actualiza los datos de la tarea.</DialogDescription>
        </DialogHeader>
        <form
          key={task.version}
          ref={formRef}
          onSubmit={onSubmit}
          className="flex max-h-[70vh] flex-col"
        >
          <div className="scroll-fade no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <TaskFormFields
              idPrefix={`edit-${task.id}`}
              members={members}
              onMemberIdsChange={markDirty}
              defaults={{
                title: task.title,
                description: task.description,
                client_title: task.client_title,
                client_summary: task.client_summary,
                member_ids: task.member_ids,
                status: task.status,
                priority: task.priority,
                due_date: task.due_date,
                is_client_visible: task.is_client_visible,
              }}
            />
          </div>
          <div className="border-border flex shrink-0 items-center justify-end gap-3 border-t pt-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} isDisabled={!isDirty} pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
      <VersionConflictDialog
        open={conflictOpen}
        entityName="tarea"
        onKeepEditing={() => setConflictOpen(false)}
        onReload={() => {
          setConflictOpen(false)
          setOpen(false)
          router.refresh()
        }}
      />
    </Dialog>
  )
}
