import { BellRing, CircleCheck as CheckCircle2, ListTodo, Phone } from 'lucide-react'
import Link from 'next/link'

import { LeadCallLink } from '@/app/(app)/leads/[id]/phone-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ActionLeadRow, MyTaskRow } from '@/lib/dashboard/types'
import { leadDisplayName } from '@/lib/leads/utils'
import { LEAD_STATUS, TASK_STATUS } from '@/lib/status'
import { relativeTime } from '@/lib/utils'

import { ClaimLeadButton } from './claim-lead-button'

export function MyDayTaskItem({
  task,
  showAssignee,
  onCompleteAction,
}: {
  task: MyTaskRow
  showAssignee: boolean
  onCompleteAction: (id: string) => void
}) {
  const overdue = task.action_at ? new Date(task.action_at) < new Date() : false

  return (
    <li className="flex items-center justify-between gap-2">
      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="flex items-center gap-1.5 truncate text-sm">
          {task.kind === 'reminder' ? (
            <BellRing className="size-3 shrink-0 text-blue-500" />
          ) : (
            <ListTodo className="text-muted-foreground size-3 shrink-0" />
          )}
          {task.title}
        </span>
        {task.contextLabel ? (
          <span className="text-muted-foreground block truncate text-xs">{task.contextLabel}</span>
        ) : null}
        {showAssignee && task.assigneeName ? (
          <span className="text-muted-foreground block truncate text-xs">{task.assigneeName}</span>
        ) : null}
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.action_at ? (
          <Badge variant={overdue ? 'danger' : 'info'}>{relativeTime(task.action_at)}</Badge>
        ) : (
          <StatusBadge meta={TASK_STATUS} value={task.status} />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Marcar como completada: ${task.title}`}
          title="Marcar como completada"
          onClick={() => onCompleteAction(task.id)}
          className="text-muted-foreground hover:text-green-600 dark:hover:text-green-500"
        >
          <CheckCircle2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </li>
  )
}

export function MyDayLeadItem({
  lead,
  showAssignee,
  onClaimAction,
}: {
  lead: ActionLeadRow
  showAssignee: boolean
  onClaimAction?: (id: string) => void
}) {
  const displayName = leadDisplayName(lead)

  return (
    <li className="flex items-center justify-between gap-2">
      <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate text-sm">{displayName}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {lead.company ?? 'Sin empresa'}
          {showAssignee && lead.assigneeName ? ` · ${lead.assigneeName}` : ''} ·{' '}
          {relativeTime(lead.since)}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge meta={LEAD_STATUS} value={lead.status} />
        {onClaimAction ? (
          <ClaimLeadButton leadId={lead.id} onClaimAction={onClaimAction} />
        ) : lead.phone ? (
          <LeadCallLink
            leadId={lead.id}
            phone={lead.phone}
            title={`Llamar a ${displayName}`}
            aria-label={`Llamar a ${displayName}`}
            className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
          >
            <Phone className="size-3.5" />
          </LeadCallLink>
        ) : null}
      </div>
    </li>
  )
}
