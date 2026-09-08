'use client'

import { CalendarDays as CalendarClock, ChevronDown, Hand, ListTodo } from 'lucide-react'
import { type ReactNode, useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@doscientos/ui'

import {
  type ScheduleMember,
  ScheduleReminderDialog,
} from '../../reminders/schedule-reminder-dialog'
import { claimLead } from '../actions'
import {
  type MeetMember,
  QCallDialog,
  QEmailDialog,
  QMeetDialog,
  QMeetNowDialog,
  QNoteDialog,
  QSendEmailDialog,
  QWhatsAppDialog,
} from '../lead-quick-action-dialogs'
import { ExtractTasksDialog, type ExtractTasksDialogProps } from './extract-tasks-dialog'
import { GmailSyncButton } from './gmail-sync-button'

type Props = {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  openCallInitially?: boolean
  openScheduleInitially?: boolean
  defaultDurationMinutes?: number | null
  claimable?: boolean
  aiEnabled?: boolean
  googleEnabled?: boolean
  projects?: Array<{ id: string; name: string }>
  meetMembers?: MeetMember[]
  /** Team members for the "Agendar" assignee picker. */
  scheduleMembers?: ScheduleMember[]
  createTaskAction?: ExtractTasksDialogProps['createTaskAction']
}

export function LeadQuickActions({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  senderName,
  openCallInitially,
  openScheduleInitially,
  defaultDurationMinutes,
  claimable,
  aiEnabled,
  googleEnabled,
  projects = [],
  meetMembers = [],
  scheduleMembers = [],
  createTaskAction,
}: Props) {
  const canExtractTasks = aiEnabled && createTaskAction
  const secondaryActionCount = 2 + (googleEnabled ? 3 : 0) + (canExtractTasks ? 1 : 0)

  return (
    <div className="flex flex-col gap-2">
      {claimable && <ClaimButton leadId={leadId} />}
      <div className="grid grid-cols-2 gap-2 [&_button]:h-auto [&_button]:min-h-8 [&_button]:px-2 [&_button]:text-left [&_button]:whitespace-normal [&_button_span]:text-xs">
        <QCallDialog
          leadId={leadId}
          leadPhone={leadPhone}
          leadName={leadName}
          leadEmail={leadEmail}
          senderName={senderName}
          aiEnabled={aiEnabled}
          openInitially={openCallInitially}
          defaultDurationMinutes={defaultDurationMinutes}
        />
        <QWhatsAppDialog
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          senderName={senderName}
          aiEnabled={aiEnabled}
        />
        <QSendEmailDialog leadId={leadId} leadEmail={leadEmail} aiEnabled={aiEnabled} />
        <ScheduleDialog
          leadId={leadId}
          leadName={leadName}
          members={scheduleMembers}
          openInitially={openScheduleInitially}
        />
      </div>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group/more w-full justify-between px-2">
            <span className="flex items-center gap-1.5">
              Más acciones
              <span className="text-muted-foreground text-xs font-normal">
                {secondaryActionCount}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 transition-transform group-aria-expanded/more:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="bg-muted/20 flex flex-col gap-3 rounded-lg border p-2">
            <ActionGroup label="Registrar">
              <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
              <QNoteDialog leadId={leadId} />
            </ActionGroup>
            {googleEnabled && (
              <>
                <ActionGroup label="Reuniones">
                  <QMeetNowDialog
                    leadId={leadId}
                    leadName={leadName}
                    leadEmail={leadEmail}
                    meetMembers={meetMembers}
                  />
                  <QMeetDialog
                    leadId={leadId}
                    leadName={leadName}
                    leadEmail={leadEmail}
                    projects={projects}
                    meetMembers={meetMembers}
                  />
                </ActionGroup>
                <ActionGroup label="Herramientas">
                  <GmailSyncButton leadId={leadId} leadEmail={leadEmail} />
                  {canExtractTasks && (
                    <ExtractTasksDialog
                      leadId={leadId}
                      createTaskAction={createTaskAction}
                      trigger={
                        <ActionTrigger
                          icon={<ListTodo className="size-4" />}
                          label="Extraer tareas IA"
                        />
                      }
                    />
                  )}
                </ActionGroup>
              </>
            )}
            {!googleEnabled && canExtractTasks && (
              <ActionGroup label="Herramientas">
                <ExtractTasksDialog
                  leadId={leadId}
                  createTaskAction={createTaskAction}
                  trigger={
                    <ActionTrigger
                      icon={<ListTodo className="size-4" />}
                      label="Extraer tareas IA"
                    />
                  }
                />
              </ActionGroup>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function ActionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground px-1 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function ClaimButton({ leadId }: { leadId: string }) {
  const [claimed, setClaimed] = useState(false)
  const [, startTransition] = useTransition()

  if (claimed) return null

  const onClick = () => {
    setClaimed(true) // optimistic: hide button immediately
    startTransition(async () => {
      const res = await claimLead({ leadId })
      if (!res.ok) {
        setClaimed(false) // revert
        sileo.error({ title: res.error })
      }
    })
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={onClick}
    >
      <span className="text-primary-foreground/70">
        <Hand className="size-4" />
      </span>
      <span className="text-sm font-medium">Asignármelo</span>
    </Button>
  )
}

function ActionTrigger({
  icon,
  label,
  ...rest
}: { icon: ReactNode; label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2" {...rest}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Button>
  )
}

// ---------------- SCHEDULE (reminder) ----------------

function ScheduleDialog({
  leadId,
  leadName,
  members,
  openInitially = false,
}: {
  leadId: string
  leadName: string
  members?: ScheduleMember[]
  openInitially?: boolean
}) {
  const [open, setOpen] = useState(openInitially)

  return (
    <ScheduleReminderDialog
      leadId={leadId}
      defaultTitle={`Llamar a ${leadName}`}
      defaultActionType="call"
      members={members}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <ActionTrigger icon={<CalendarClock className="size-4" />} label="Agendar llamada" />
      }
    />
  )
}
