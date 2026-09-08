import { isGoogleEnabled, serverEnv } from '@/lib/env'
import { listEvents } from '@/lib/google/calendar'
import { resolveSubject } from '@/lib/google/client'
import { createServerClient } from '@/lib/supabase/server'
import { toIsoDate } from '@/lib/utils/date'

import type { CalendarEvent, CalendarEventKind } from './types'

export type CalendarFetchOptions = {
  from: Date
  to: Date
  /** Member IDs to scope tasks + reminders to. Never empty in practice. */
  memberIds: string[]
  layers: CalendarEventKind[]
  isAdmin: boolean
}

// ─── Row → CalendarEvent normalizers ─────────────────────────────────────────

const TASK_DONE_STATUSES = new Set(['done', 'completed', 'cancelled'])

function taskToEvent(row: Record<string, unknown>): CalendarEvent {
  const project = row.projects as { id: string; name: string } | null
  const lead = row.leads as { id: string; name: string } | null
  const client = row.clients as { id: string; name: string } | null
  const assignee = row.assignee as { id: string; name: string } | null
  const status = row.status as string
  return {
    id: `task:${row.id as string}`,
    kind: 'task',
    title: row.title as string,
    start: row.due_date as string,
    end: row.due_date as string,
    allDay: true,
    href: project
      ? `/projects/${project.id}`
      : lead
        ? `/leads/${lead.id}`
        : client
          ? `/clients/${client.id}`
          : '/tasks',
    editable: !TASK_DONE_STATUSES.has(status),
    done: TASK_DONE_STATUSES.has(status),
    memberId: assignee?.id ?? null,
    memberName: assignee?.name ?? null,
    meta: {
      status,
      priority: row.priority as string,
      projectId: project?.id,
      projectName: project?.name,
      leadId: lead?.id,
      leadName: lead?.name,
      clientId: client?.id,
      clientName: client?.name,
    },
  }
}

function reminderToEvent(row: Record<string, unknown>): CalendarEvent {
  const lead = row.leads as { id: string; name: string } | null
  const client = row.clients as { id: string; name: string } | null
  const project = row.projects as { id: string; name: string } | null
  const assignee = row.assignee as { id: string; name: string } | null
  const href = lead
    ? `/leads/${lead.id}`
    : client
      ? `/clients/${client.id}`
      : project
        ? `/projects/${project.id}`
        : null
  const start = row.start_at as string
  return {
    id: `reminder:${row.id as string}`,
    kind: 'reminder',
    title: row.title as string,
    start,
    end: start,
    allDay: false,
    href,
    editable: true,
    done: Boolean(row.completed_at),
    memberId: assignee?.id ?? null,
    memberName: assignee?.name ?? null,
    meta: {
      description: (row.description as string | null) ?? undefined,
      leadId: lead?.id,
      leadName: lead?.name,
      clientId: client?.id,
      clientName: client?.name,
      projectId: project?.id,
      projectName: project?.name,
    },
  }
}

function subscriptionToEvent(row: Record<string, unknown>): CalendarEvent {
  const client = row.clients as { name: string } | null
  const date = row.next_invoice_date as string
  return {
    id: `subscription:${row.id as string}`,
    kind: 'subscription',
    title: row.name as string,
    start: date,
    end: date,
    allDay: true,
    href: '/subscriptions',
    editable: false,
    done: false,
    memberId: null,
    memberName: null,
    meta: { clientName: client?.name, amount: Number(row.amount ?? 0) },
  }
}

function invoiceToEvent(row: Record<string, unknown>): CalendarEvent {
  const client = row.clients as { name: string } | null
  const date = row.due_date as string
  return {
    id: `invoice_due:${row.id as string}`,
    kind: 'invoice_due',
    title: (row.full_number as string) ?? 'Factura',
    start: date,
    end: date,
    allDay: true,
    href: `/invoices/${row.id as string}`,
    editable: false,
    done: false,
    memberId: null,
    memberName: null,
    meta: { clientName: client?.name, amount: Number(row.total ?? 0) },
  }
}

function invoicePaidToEvent(row: Record<string, unknown>): CalendarEvent {
  const client = row.clients as { name: string } | null
  // Use due_date as the anchor (most meaningful date for "when it was collected")
  const date = (row.due_date ?? row.issue_date) as string
  return {
    id: `invoice_paid:${row.id as string}`,
    kind: 'invoice_paid',
    title: `✓ ${(row.full_number as string) ?? 'Factura'}`,
    start: date,
    end: date,
    allDay: true,
    href: `/invoices/${row.id as string}`,
    editable: false,
    done: true,
    memberId: null,
    memberName: null,
    meta: { clientName: client?.name, amount: Number(row.total ?? 0) },
  }
}

function proposalExpiryToEvent(row: Record<string, unknown>): CalendarEvent {
  const client = row.clients as { name: string } | null
  const date = row.valid_until as string
  const status = row.status as string
  const isPast = status === 'expired' || status === 'rejected' || status === 'accepted'
  return {
    id: `proposal_expiry:${row.id as string}`,
    kind: 'proposal_expiry',
    title: (row.title as string) ?? 'Propuesta',
    start: date,
    end: date,
    allDay: true,
    href: `/proposals/${row.id as string}`,
    editable: false,
    done: isPast,
    memberId: null,
    memberName: null,
    meta: { clientName: client?.name, status },
  }
}

function eventToEvent(row: Record<string, unknown>): CalendarEvent {
  const attendees = (row.task_members as { member: { id: string; name: string } | null }[]) ?? []
  const members = attendees
    .map((a) => a.member)
    .filter((m): m is { id: string; name: string } => !!m)
  const allDay = Boolean(row.all_day)
  const startRaw = row.start_at as string
  const endRaw = (row.end_at as string | null) ?? startRaw
  return {
    id: `event:${row.id as string}`,
    kind: 'event',
    title: row.title as string,
    start: allDay ? startRaw.slice(0, 10) : startRaw,
    end: allDay ? endRaw.slice(0, 10) : endRaw,
    allDay,
    href: null,
    editable: true,
    done: false,
    memberId: null,
    memberName: null,
    memberIds: members.map((m) => m.id),
    meta: {
      description: (row.description as string | null) ?? undefined,
      location: (row.location as string | null) ?? undefined,
      htmlLink: (row.url as string | null) ?? undefined,
      attendees: members.map((m) => m.name),
    },
  }
}

function milestoneToEvent(row: Record<string, unknown>): CalendarEvent {
  const project = row.projects as { id: string; name: string } | null
  const date = row.due_date as string
  return {
    id: `milestone:${row.id as string}`,
    kind: 'milestone',
    title: row.name as string,
    start: date,
    end: date,
    allDay: true,
    href: project ? `/projects/${project.id}` : null,
    editable: false,
    done: Boolean(row.completed_at),
    memberId: null,
    memberName: null,
    meta: { projectId: project?.id, projectName: project?.name },
  }
}

// ─── Main fetcher ─────────────────────────────────────────────────────────────

export async function getCalendarEvents(opts: CalendarFetchOptions): Promise<CalendarEvent[]> {
  const supabase = await createServerClient()
  const { from, to, memberIds, layers, isAdmin } = opts
  const fromDate = toIsoDate(from)
  const toDate = toIsoDate(to)
  const fromISO = from.toISOString()
  const toISO = to.toISOString()

  const [
    tasksRes,
    remindersRes,
    subsRes,
    invoicesRes,
    invoicesPaidRes,
    proposalsRes,
    milestonesRes,
    eventsRes,
  ] = await Promise.all([
    // Tasks — scoped to memberIds via assignee_id, exclude calendar events
    layers.includes('task')
      ? supabase
          .from('tasks')
          .select(
            'id, title, status, priority, due_date, projects(id,name), leads(id,name), clients(id,name), assignee:team_members!assignee_id(id,name)',
          )
          .eq('kind', 'task')
          .gte('due_date', fromDate)
          .lte('due_date', toDate)
          .in('assignee_id', memberIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Reminders — stored as tasks with kind='reminder', scoped via assignee_id
    layers.includes('reminder')
      ? supabase
          .from('tasks')
          .select(
            'id, title, description, start_at, completed_at, leads(id,name), clients(id,name), projects(id,name), assignee:team_members!assignee_id(id,name)',
          )
          .eq('kind', 'reminder')
          .gte('start_at', fromISO)
          .lte('start_at', toISO)
          .is('completed_at', null)
          .in('assignee_id', memberIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Subscriptions — admin only (finance layer)
    layers.includes('subscription') && isAdmin
      ? supabase
          .from('subscriptions')
          .select('id, name, amount, next_invoice_date, clients(name)')
          .gte('next_invoice_date', fromDate)
          .lte('next_invoice_date', toDate)
          .eq('status', 'active')
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Invoices due (sent, not yet paid) — admin only
    layers.includes('invoice_due') && isAdmin
      ? supabase
          .from('invoices')
          .select('id, full_number, due_date, total, clients(name)')
          .gte('due_date', fromDate)
          .lte('due_date', toDate)
          .in('status', ['sent', 'issued', 'overdue'])
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Invoices paid (cobros) — admin only
    layers.includes('invoice_paid') && isAdmin
      ? supabase
          .from('invoices')
          .select('id, full_number, issue_date, due_date, total, clients(name)')
          .gte('due_date', fromDate)
          .lte('due_date', toDate)
          .eq('status', 'paid')
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Proposals expiry — admin only
    layers.includes('proposal_expiry') && isAdmin
      ? supabase
          .from('proposals')
          .select('id, title, valid_until, status, clients(name)')
          .gte('valid_until', fromDate)
          .lte('valid_until', toDate)
          .not('valid_until', 'is', null)
          .not('status', 'in', '("draft")')
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),

    // Milestones — all team members can see
    layers.includes('milestone')
      ? supabase
          .from('milestones')
          .select('id, name, due_date, completed_at, projects(id,name)')
          .gte('due_date', fromDate)
          .lte('due_date', toDate)
          .not('status', 'in', '("cancelled")')
          .not('due_date', 'is', null)
      : Promise.resolve({ data: [] }),

    // Events (charlas/eventos) — stored in tasks with kind='event', shared team-wide
    layers.includes('event')
      ? supabase
          .from('tasks')
          .select(
            'id, title, description, location, start_at, end_at, all_day, task_members(member:team_members(id,name))',
          )
          .eq('kind', 'event')
          .gte('start_at', fromISO)
          .lte('start_at', toISO)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),
  ])

  const events: CalendarEvent[] = [
    ...(tasksRes.data ?? []).map((r) => taskToEvent(r as Record<string, unknown>)),
    ...(remindersRes.data ?? []).map((r) => reminderToEvent(r as Record<string, unknown>)),
    ...(subsRes.data ?? []).map((r) => subscriptionToEvent(r as Record<string, unknown>)),
    ...(invoicesRes.data ?? []).map((r) => invoiceToEvent(r as Record<string, unknown>)),
    ...(invoicesPaidRes.data ?? []).map((r) => invoicePaidToEvent(r as Record<string, unknown>)),
    ...(proposalsRes.data ?? []).map((r) => proposalExpiryToEvent(r as Record<string, unknown>)),
    ...(milestonesRes.data ?? []).map((r) => milestoneToEvent(r as Record<string, unknown>)),
    ...(eventsRes.data ?? []).map((r) => eventToEvent(r as Record<string, unknown>)),
  ]

  // Google Calendar — non-fatal: silently omit if unconfigured or failing
  if (layers.includes('google_meeting') && isGoogleEnabled()) {
    const calendarId = serverEnv().GOOGLE_CALENDAR_ID
    if (calendarId) {
      try {
        const googleEvents = await listEvents({
          subject: resolveSubject(),
          calendarId,
          timeMin: from,
          timeMax: to,
        })
        for (const ge of googleEvents) {
          if (!ge.start) continue
          events.push({
            id: `google_meeting:${ge.id}`,
            kind: 'google_meeting',
            title: ge.summary ?? 'Sin título',
            start: ge.start,
            end: ge.end ?? ge.start,
            allDay: ge.allDay,
            href: ge.htmlLink,
            editable: false,
            done: false,
            memberId: null,
            memberName: null,
            meta: {
              description: ge.description ?? undefined,
              htmlLink: ge.htmlLink ?? undefined,
              meetUrl: ge.hangoutLink ?? undefined,
            },
          })
        }
      } catch {
        // Non-fatal: calendar renders without Google meetings
      }
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start))
}
