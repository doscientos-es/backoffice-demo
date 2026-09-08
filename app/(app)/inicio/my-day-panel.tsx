'use client'

import { Inbox, ListTodo, PartyPopper, CircleUser as UserRound } from 'lucide-react'

import { claimLead } from '@/app/(app)/leads/actions'
import { updateTaskStatus } from '@/app/(app)/tasks/actions'
import { useOptimisticRemoval } from '@/lib/hooks/use-optimistic-removal'

import { MyDayColumn } from './_components/my-day-column'
import { getMyDayLeadsCopy, isTeamScope } from './_components/my-day-copy'
import { MyDayLeadItem, MyDayTaskItem } from './_components/my-day-items'
import { MyDayScopeSelector } from './_components/my-day-scope-selector'
import type { MyDayPanelProps } from './_components/my-day-types'

export type { MyDayPanelProps } from './_components/my-day-types'

/**
 * "Tu día": a personal action queue, with an admin/owner scope selector.
 */
export function MyDayPanel({ tasks, myLeads, unassignedLeads, scope }: MyDayPanelProps) {
  const { items: visibleTasks, remove: completeTaskOptimistic } = useOptimisticRemoval(tasks)
  const { items: visibleUnassigned, remove: claimOptimistic } =
    useOptimisticRemoval(unassignedLeads)
  const teamScope = isTeamScope(scope)
  const leadsCopy = getMyDayLeadsCopy(scope)

  return (
    <div className="flex flex-col gap-3">
      {scope.canViewTeam ? (
        <div className="flex justify-end">
          <MyDayScopeSelector scope={scope} />
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <MyDayColumn
          icon={<ListTodo className="size-4 text-blue-500" />}
          title="Qué hacer ahora"
          count={visibleTasks.length}
          href="/tasks"
          empty={
            <>
              No tienes acciones pendientes.{' '}
              <PartyPopper aria-hidden="true" className="inline size-4" />
            </>
          }
        >
          {visibleTasks.map((t) => (
            <MyDayTaskItem
              key={t.id}
              task={t}
              showAssignee={teamScope}
              onCompleteAction={(id) =>
                completeTaskOptimistic(id, () => updateTaskStatus({ taskId: id, status: 'done' }))
              }
            />
          ))}
        </MyDayColumn>

        <MyDayColumn
          icon={<UserRound className="size-4 text-emerald-500" />}
          title={leadsCopy.title}
          count={myLeads.length}
          href="/leads"
          empty={leadsCopy.empty}
        >
          {myLeads.map((l) => (
            <MyDayLeadItem key={l.id} lead={l} showAssignee={teamScope} />
          ))}
        </MyDayColumn>

        <MyDayColumn
          icon={<Inbox className="size-4 text-amber-500" />}
          title="Leads sin asignar"
          count={visibleUnassigned.length}
          href="/leads"
          empty="Todos los leads tienen responsable."
        >
          {visibleUnassigned.map((l) => (
            <MyDayLeadItem
              key={l.id}
              lead={l}
              showAssignee={false}
              onClaimAction={(id) => claimOptimistic(id, () => claimLead({ leadId: id }))}
            />
          ))}
        </MyDayColumn>
      </div>
    </div>
  )
}
