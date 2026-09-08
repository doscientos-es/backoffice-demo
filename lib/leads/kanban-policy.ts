import { isTerminalLeadStatus, nextActionRank, nextActionState } from '@/lib/leads/pipeline'
import type { LeadListItem } from '@/lib/leads/types'

export type LeadKanbanColumnId =
  | 'new'
  | 'in_conversation'
  | 'waiting'
  | 'meeting'
  | 'quoted'
  | 'won'
  | 'lost'
  | 'not_interested'
  | 'archived'

export type LeadKanbanColumn = {
  id: LeadKanbanColumnId
  label: string
  description: string
  tone: string
  dot: string
  compact?: boolean
}

export const LEAD_KANBAN_COLUMNS: LeadKanbanColumn[] = [
  {
    id: 'new',
    label: 'Nuevo',
    description: 'Primer contacto pendiente',
    tone: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  {
    id: 'in_conversation',
    label: 'En conversación',
    description: 'Conversación activa',
    tone: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  {
    id: 'waiting',
    label: 'Esperando respuesta',
    description: 'Esperando respuesta',
    tone: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  {
    id: 'meeting',
    label: 'Reunión agendada',
    description: 'Llamada o reunión futura ya acordada',
    tone: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  {
    id: 'quoted',
    label: 'Presupuestado',
    description: 'Propuesta enviada',
    tone: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
  },
  {
    id: 'won',
    label: 'Ganado',
    description: 'Cerrado con éxito',
    tone: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    compact: true,
  },
  {
    id: 'lost',
    label: 'Perdido',
    description: 'Cerrado',
    tone: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    compact: true,
  },
  {
    id: 'not_interested',
    label: 'No interesa',
    description: 'Cerrado',
    tone: 'text-zinc-700 dark:text-zinc-300',
    dot: 'bg-zinc-400',
    compact: true,
  },
  {
    id: 'archived',
    label: 'Archivado',
    description: 'Fuera del flujo',
    tone: 'text-muted-foreground',
    dot: 'bg-muted-foreground/40',
    compact: true,
  },
]

export const DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS = LEAD_KANBAN_COLUMNS.filter(
  (column) => column.compact,
).map((column) => column.id)

export function groupLeadsForKanban(leads: LeadListItem[], now = new Date()) {
  const grouped = new Map<LeadKanbanColumnId, LeadListItem[]>(
    LEAD_KANBAN_COLUMNS.map((column) => [column.id, []]),
  )
  for (const lead of leads) grouped.get(boardColumnForLead(lead, now))?.push(lead)
  for (const column of grouped.values()) column.sort((a, b) => compareLeadsByUrgency(a, b, now))
  return grouped
}

export function boardColumnForLead(lead: LeadListItem, now = new Date()): LeadKanbanColumnId {
  if (isTerminalLeadStatus(lead.status)) {
    return lead.status as 'won' | 'lost' | 'not_interested' | 'archived'
  }
  const scheduledMeetingAt = scheduledMeetingAtForLead(lead)
  if (scheduledMeetingAt && new Date(scheduledMeetingAt).getTime() >= now.getTime()) {
    return 'meeting'
  }

  if (lead.status === 'new') return 'new'
  if (lead.status === 'contacted') return 'waiting'
  if (lead.status === 'quoted') return 'quoted'
  return 'in_conversation'
}

/**
 * A booked call or meeting supersedes an older pending reminder on the board.
 * The original reminder is still retained for its own task workflow; this only
 * makes the Kanban represent the action currently driving the opportunity.
 */
export function nextActionForKanban(
  lead: LeadListItem,
  now = new Date(),
): LeadListItem['next_action'] {
  const scheduledMeetingAt = scheduledMeetingAtForLead(lead)
  if (!scheduledMeetingAt || new Date(scheduledMeetingAt).getTime() < now.getTime()) {
    return lead.next_action
  }
  if (lead.next_action?.remind_at === scheduledMeetingAt) return lead.next_action

  return {
    id: `scheduled-meeting:${lead.id}`,
    title: 'Reunión agendada',
    remind_at: scheduledMeetingAt,
    action_type: 'meeting',
  }
}

export function sumLeadEstimatedValue(leads: LeadListItem[]): number {
  return leads.reduce((total, lead) => total + (lead.estimated_value ?? 0), 0)
}

export function countLeadsNeedingAttention(leads: LeadListItem[], now = new Date()): number {
  return leads.filter((lead) => {
    const state = nextActionState(lead.status, nextActionForKanban(lead, now), now)
    return state === 'overdue' || state === 'missing'
  }).length
}

function compareLeadsByUrgency(a: LeadListItem, b: LeadListItem, now: Date): number {
  const nextActionA = nextActionForKanban(a, now)
  const nextActionB = nextActionForKanban(b, now)
  const rankA = nextActionRank(nextActionState(a.status, nextActionA, now))
  const rankB = nextActionRank(nextActionState(b.status, nextActionB, now))
  if (rankA !== rankB) return rankA - rankB
  const dueA = nextActionA ? new Date(nextActionA.remind_at).getTime() : 0
  const dueB = nextActionB ? new Date(nextActionB.remind_at).getTime() : 0
  if (dueA !== dueB) return dueA - dueB
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
}

function scheduledMeetingAtForLead(lead: LeadListItem): string | null {
  return (
    lead.scheduled_meeting_at ??
    (lead.next_action?.action_type === 'call' || lead.next_action?.action_type === 'meeting'
      ? lead.next_action.remind_at
      : null)
  )
}
