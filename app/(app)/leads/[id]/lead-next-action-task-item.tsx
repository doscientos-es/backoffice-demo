'use client'

import {
  CalendarDays as CalendarClock,
  CircleCheck as CheckCircle2,
  ListTodo,
  LoaderCircle as Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { TASK_STATUS, type TaskStatus } from '@/lib/status'

import { ScheduleReminderDialog } from '../../reminders/schedule-reminder-dialog'
import { updateTaskStatus } from '../../tasks/actions'
import { TaskCreateDialog } from '../../tasks/task-create-dialog'

type Props = {
  task: {
    id: string
    title: string
    status: TaskStatus
    when: string | null
    whenLabel: string | null
    overdue: boolean
  }
  leadId: string
  members: Array<{ id: string; name: string }>
  currentUserId: string
}

/** Completes a lead task in place and immediately offers a meaningful next step. */
export function LeadNextActionTaskItem({ task, leadId, members, currentUserId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [completed, setCompleted] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  function complete() {
    startTransition(async () => {
      const result = await updateTaskStatus({
        taskId: task.id,
        status: 'done',
      })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      setCompleted(true)
      setFollowUpOpen(true)
    })
  }

  return (
    <>
      {!completed ? (
        <li className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm">
          <Link href={`/tasks/${task.id}`} className="min-w-0 truncate font-medium hover:underline">
            <span className="text-muted-foreground mr-2 text-xs">Tarea</span>
            {task.title}
          </Link>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <StatusBadge meta={TASK_STATUS} value={task.status} />
            {task.whenLabel ? (
              <span
                className={task.overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}
              >
                {task.whenLabel}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Marcar como hecha: ${task.title}`}
              title="Marcar como hecha"
              disabled={pending}
              onClick={complete}
              className="text-muted-foreground hover:text-green-600 dark:hover:text-green-500"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
            </Button>
          </div>
        </li>
      ) : null}

      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cuál es el siguiente paso?</DialogTitle>
            <DialogDescription>
              La tarea se ha completado. Deja el seguimiento preparado para que este lead no se
              enfríe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              className="justify-start"
              onClick={() => {
                setFollowUpOpen(false)
                setCreateTaskOpen(true)
              }}
            >
              <ListTodo className="size-4" />
              Crear nueva tarea
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                setFollowUpOpen(false)
                setScheduleOpen(true)
              }}
            >
              <CalendarClock className="size-4" />
              Agendar aviso o llamada
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFollowUpOpen(false)}>
              La llamada o reunión ya está agendada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TaskCreateDialog
        leadId={leadId}
        members={members}
        currentUserId={currentUserId}
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onCreated={() => router.refresh()}
      />
      <ScheduleReminderDialog
        leadId={leadId}
        members={members}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultTitle={`Seguimiento: ${task.title}`}
        onScheduled={() => router.refresh()}
      />
    </>
  )
}
