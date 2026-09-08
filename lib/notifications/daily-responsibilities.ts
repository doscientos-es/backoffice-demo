import { ACTIVE_LEAD_STATUSES } from '@/lib/leads/pipeline'
import { findLeadIdsWithScheduledContact } from '@/lib/leads/scheduled-contact'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

const OPEN_TASK_STATUSES = ['todo', 'in_progress', 'in_review']
const FOLLOW_UP_HOURS = 24
const DAILY_EVENT_TYPE = 'daily_responsibilities'

export type AssignedWorkItem = {
  assigneeId: string | null
  memberIds: string[]
  dueAt: string
}

export type DailyResponsibility = {
  recipientId: string
  overdueTasks: number
  tasksDueToday: number
  pendingReminders: number
  staleLeads: number
}

type ResponsibilityInput = {
  tasks: AssignedWorkItem[]
  reminders: AssignedWorkItem[]
  staleLeads: Array<{ assignedTo: string }>
  today: string
}

function recipientsFor(item: AssignedWorkItem): string[] {
  return item.memberIds.length > 0
    ? [...new Set(item.memberIds)]
    : item.assigneeId
      ? [item.assigneeId]
      : []
}

export function collectDailyResponsibilities({
  tasks,
  reminders,
  staleLeads,
  today,
}: ResponsibilityInput): DailyResponsibility[] {
  const summaries = new Map<string, DailyResponsibility>()
  const getSummary = (recipientId: string) => {
    const existing = summaries.get(recipientId)
    if (existing) return existing
    const created = {
      recipientId,
      overdueTasks: 0,
      tasksDueToday: 0,
      pendingReminders: 0,
      staleLeads: 0,
    }
    summaries.set(recipientId, created)
    return created
  }

  for (const task of tasks) {
    for (const recipientId of recipientsFor(task)) {
      const summary = getSummary(recipientId)
      if (task.dueAt < today) summary.overdueTasks += 1
      else summary.tasksDueToday += 1
    }
  }
  for (const reminder of reminders) {
    for (const recipientId of recipientsFor(reminder)) getSummary(recipientId).pendingReminders += 1
  }
  for (const lead of staleLeads) getSummary(lead.assignedTo).staleLeads += 1

  return [...summaries.values()].sort((a, b) => a.recipientId.localeCompare(b.recipientId))
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function joinCounts(items: string[]): string {
  if (items.length < 2) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

export function formatDailyResponsibilityBody(summary: DailyResponsibility): string {
  const items = [
    summary.overdueTasks && formatCount(summary.overdueTasks, 'tarea vencida', 'tareas vencidas'),
    summary.tasksDueToday
      ? formatCount(summary.tasksDueToday, 'tarea para hoy', 'tareas para hoy')
      : 0,
    summary.pendingReminders
      ? formatCount(summary.pendingReminders, 'recordatorio pendiente', 'recordatorios pendientes')
      : 0,
    summary.staleLeads
      ? formatCount(summary.staleLeads, 'lead por responder', 'leads por responder')
      : 0,
  ].filter((item): item is string => Boolean(item))
  const priority = summary.overdueTasks > 0 ? 'Prioridad: tienes' : 'Tienes'
  return `Buenos días. ${priority} ${joinCounts(items)}.`
}

function toAssignedWorkItems(rows: unknown[]): AssignedWorkItem[] {
  return rows.map((row) => {
    const item = row as {
      assignee_id: string | null
      due_date?: string | null
      start_at?: string | null
      task_members?: Array<{ member_id: string }> | null
    }
    return {
      assigneeId: item.assignee_id,
      memberIds: (item.task_members ?? []).map((member) => member.member_id),
      dueAt: item.due_date ?? item.start_at ?? '',
    }
  })
}

export async function sendDailyResponsibilityNotifications(now = new Date()) {
  const admin = createAdminClient()
  const today = now.toISOString().slice(0, 10)
  const followUpCutoff = new Date(now.getTime() - FOLLOW_UP_HOURS * 3_600_000).toISOString()
  const [tasksRes, remindersRes, leadsRes] = await Promise.all([
    admin
      .from('tasks')
      .select('assignee_id, due_date, task_members(member_id)')
      .eq('kind', 'task')
      .in('status', OPEN_TASK_STATUSES)
      .lte('due_date', today)
      .is('deleted_at', null),
    admin
      .from('tasks')
      .select('assignee_id, start_at, task_members(member_id)')
      .eq('kind', 'reminder')
      .is('completed_at', null)
      .lte('start_at', now.toISOString())
      .is('deleted_at', null),
    admin
      .from('leads')
      .select('id, assigned_to')
      .in('status', ACTIVE_LEAD_STATUSES)
      .not('assigned_to', 'is', null)
      .lt('updated_at', followUpCutoff)
      .is('deleted_at', null),
  ])
  for (const result of [tasksRes, remindersRes, leadsRes]) {
    if (result.error) throw new Error(result.error.message)
  }

  const scheduledContactLeadIds = await findLeadIdsWithScheduledContact(
    admin,
    (leadsRes.data ?? []).map((lead) => lead.id),
    now,
  )

  const summaries = collectDailyResponsibilities({
    tasks: toAssignedWorkItems(tasksRes.data ?? []),
    reminders: toAssignedWorkItems(remindersRes.data ?? []),
    staleLeads: (leadsRes.data ?? []).flatMap((lead) =>
      lead.assigned_to && !scheduledContactLeadIds.has(lead.id)
        ? [{ assignedTo: lead.assigned_to }]
        : [],
    ),
    today,
  })
  if (!summaries.length) return { scanned: 0, notified: 0, skipped: 0 }

  const recipientIds = summaries.map((summary) => summary.recipientId)
  const [{ data: activeMembers, error: membersError }, { data: previous, error: previousError }] =
    await Promise.all([
      admin.from('team_members').select('id').in('id', recipientIds).is('deleted_at', null),
      admin
        .from('notifications')
        .select('recipient_id')
        .eq('event_type', DAILY_EVENT_TYPE)
        .in('recipient_id', recipientIds)
        .gte('created_at', `${today}T00:00:00.000Z`),
    ])
  if (membersError) throw new Error(membersError.message)
  if (previousError) throw new Error(previousError.message)

  const activeIds = new Set((activeMembers ?? []).map((member) => member.id))
  const alreadySent = new Set((previous ?? []).map((notification) => notification.recipient_id))
  let notified = 0
  let skipped = 0
  for (const summary of summaries) {
    if (!activeIds.has(summary.recipientId) || alreadySent.has(summary.recipientId)) {
      skipped += 1
      continue
    }
    await dispatchNotifications({
      recipientIds: [summary.recipientId],
      eventType: DAILY_EVENT_TYPE,
      entityType: 'daily_responsibilities',
      entityId: summary.recipientId,
      body: formatDailyResponsibilityBody(summary),
      link: '/inicio',
    })
    notified += 1
  }
  return { scanned: summaries.length, notified, skipped }
}
