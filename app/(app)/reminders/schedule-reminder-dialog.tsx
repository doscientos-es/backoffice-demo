'use client'

import { type ReactNode, useCallback, useEffect, useState } from 'react'

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
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import {
  REMINDER_ACTION_TYPE_LABEL,
  REMINDER_ACTION_TYPES,
  type ReminderActionType,
} from '@/lib/reminders/action-types'
import { suggestedReminderDateTime } from '@/lib/reminders/date-presets'
import { datetimeLocalToIso, toDatetimeLocalValue } from '@/lib/utils/date-time'

import { createReminder } from './actions'

const SCHEDULE_PRESETS: { label: string; minutes: number }[] = [
  { label: 'En 1 h', minutes: 60 },
  { label: 'Mañana', minutes: 60 * 24 },
  { label: 'En 3 días', minutes: 60 * 24 * 3 },
  { label: 'En 1 semana', minutes: 60 * 24 * 7 },
]

export type ScheduleMember = { id: string; name: string }

type Props = {
  /** Context the reminder is linked to. Provide at most one. */
  leadId?: string
  projectId?: string
  clientId?: string
  /**
   * Element that opens the dialog (rendered via DialogTrigger asChild).
   * Omit it when driving the dialog with `open` / `onOpenChange`.
   */
  trigger?: ReactNode
  /** Controlled visibility, for callers that open the dialog programmatically. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Prefilled reminder title (e.g. the AI suggested next step). */
  defaultTitle?: string
  defaultNotes?: string
  /** ISO timestamp suggested by the AI; converted to the user's local timezone. */
  defaultRemindAt?: string | null
  /** Classifies the action in the commercial agenda. */
  defaultActionType?: ReminderActionType
  /** Team members available for assignment. When provided, a member picker is shown. */
  members?: ScheduleMember[]
  onScheduled?: () => void
}

/**
 * Universal reminder scheduling dialog — shared by lead quick actions, the AI
 * panel, and the project/client "Próximos avisos" cards. The trigger and
 * prefilled title/notes are supplied by the caller so the same form
 * (datetime + presets + assignee + notes) backs every "Agendar" entry point.
 */
export function ScheduleReminderDialog({
  leadId,
  projectId,
  clientId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  defaultTitle = '',
  defaultNotes = '',
  defaultRemindAt = null,
  defaultActionType = 'follow_up',
  members = [],
  onScheduled,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [title, setTitle] = useState(defaultTitle)
  const [remindAt, setRemindAt] = useState(suggestedReminderDateTime(defaultRemindAt))
  const [notes, setNotes] = useState(defaultNotes)
  const [actionType, setActionType] = useState<ReminderActionType>(defaultActionType)
  const [assigneeId, setAssigneeId] = useState<string>('')
  const feedback = useFormFeedback()

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const contextLabel = leadId ? 'esta lead' : projectId ? 'este proyecto' : 'este cliente'

  const resetFields = useCallback(() => {
    setTitle(defaultTitle)
    setNotes(defaultNotes)
    setActionType(defaultActionType)
    setRemindAt(suggestedReminderDateTime(defaultRemindAt))
    setAssigneeId('')
    feedback.reset()
  }, [defaultTitle, defaultNotes, defaultRemindAt, defaultActionType, feedback.reset])

  // Controlled callers flip `open` without going through the trigger, so the
  // prefilled values are refreshed here instead of in `handleOpenChange`.
  useEffect(() => {
    if (isControlled && controlledOpen) resetFields()
  }, [isControlled, controlledOpen, resetFields])

  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }

  function handleOpenChange(next: boolean) {
    if (next && !isControlled) resetFields()
    setOpen(next)
  }

  function applyPreset(minutes: number) {
    const d = new Date(Date.now() + minutes * 60_000)
    d.setSeconds(0, 0)
    setRemindAt(toDatetimeLocalValue(d))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    feedback.setPending()
    const res = await createReminder({
      leadId,
      projectId,
      clientId,
      title: title.trim(),
      actionType,
      remindAt: datetimeLocalToIso(remindAt),
      notes: notes || undefined,
      assigneeId: assigneeId || undefined,
    })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Aviso programado')
    onScheduled?.()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar aviso</DialogTitle>
          <DialogDescription>
            Crea un aviso para {contextLabel} (llamada, email, recordatorio…).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <FormRow label="Título" htmlFor="schedule-title" required>
            <Input
              id="schedule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </FormRow>
          <FormRow label="Tipo" htmlFor="schedule-action-type">
            <Select
              id="schedule-action-type"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ReminderActionType)}
            >
              {REMINDER_ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REMINDER_ACTION_TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Fecha y hora" htmlFor="schedule-when" required>
            <Input
              id="schedule-when"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SCHEDULE_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => applyPreset(p.minutes)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </FormRow>
          {members.length > 0 && (
            <FormRow label="Asignar a" htmlFor="schedule-assignee">
              <Select
                id="schedule-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Yo mismo</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </FormRow>
          )}
          <FormRow label="Notas (opcional)" htmlFor="schedule-notes">
            <Textarea
              id="schedule-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Contexto, qué tratar, próximos pasos…"
            />
          </FormRow>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
              Agendar
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
