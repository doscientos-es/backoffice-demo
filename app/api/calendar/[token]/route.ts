import { type NextRequest, NextResponse } from 'next/server'

import { createLocalDataClient } from '@/lib/demo/local-data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function icsDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function icsDateOnly(dateStr: string): string {
  // YYYYMMDD format (all-day events)
  return dateStr.replace(/-/g, '')
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function buildEvent(
  uid: string,
  summary: string,
  dtstart: string,
  dtend: string,
  description?: string,
  allDay = false,
) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
    allDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`,
    `SUMMARY:${escapeIcs(summary)}`,
  ]
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`)
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

function allDayEnd(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]!.replace(/-/g, '')
}

/**
 * GET /api/calendar/[token]
 *
 * Public iCal feed of a member's full agenda: tasks, reminders, subscriptions,
 * invoices, milestones and proposals. Access is gated by an unguessable,
 * rotatable `calendar_token`. Uses the service-role client so calendar apps
 * can reach it without a session cookie.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!token || !/^[a-f0-9-]{32,128}$/i.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const supabase = createLocalDataClient()

  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, role')
    .eq('calendar_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!member) return new NextResponse('Not found', { status: 404 })

  const memberId = member.id as string
  const isAdmin = (member.role as string) === 'admin' || (member.role as string) === 'owner'

  // Rolling window: 60 days back → 365 days forward
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 60)
  const to = new Date(now)
  to.setDate(to.getDate() + 365)
  const fromDate = from.toISOString().split('T')[0]!
  const toDate = to.toISOString().split('T')[0]!
  const fromISO = from.toISOString()
  const toISO = to.toISOString()

  const [tasksRes, remindersRes, subsRes, invoicesRes, milestonesRes, proposalsRes] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, description, due_date, projects(name)')
        .eq('assignee_id', memberId)
        .gte('due_date', fromDate)
        .lte('due_date', toDate)
        .not('status', 'in', '("done","completed","cancelled")')
        .is('deleted_at', null)
        .order('due_date'),

      supabase
        .from('reminders')
        .select('id, title, notes, remind_at')
        .eq('created_by', memberId)
        .gte('remind_at', fromISO)
        .lte('remind_at', toISO)
        .is('completed_at', null),

      isAdmin
        ? supabase
            .from('subscriptions')
            .select('id, name, amount, next_invoice_date, clients(name)')
            .gte('next_invoice_date', fromDate)
            .lte('next_invoice_date', toDate)
            .eq('status', 'active')
            .is('deleted_at', null)
        : Promise.resolve({ data: [] }),

      isAdmin
        ? supabase
            .from('invoices')
            .select('id, full_number, due_date, total, clients(name)')
            .gte('due_date', fromDate)
            .lte('due_date', toDate)
            .in('status', ['sent', 'issued', 'overdue'])
            .is('deleted_at', null)
        : Promise.resolve({ data: [] }),

      supabase
        .from('milestones')
        .select('id, name, due_date, projects(name)')
        .gte('due_date', fromDate)
        .lte('due_date', toDate)
        .not('status', 'in', '("cancelled")')
        .not('due_date', 'is', null),

      isAdmin
        ? supabase
            .from('proposals')
            .select('id, title, valid_until, status, clients(name)')
            .gte('valid_until', fromDate)
            .lte('valid_until', toDate)
            .not('valid_until', 'is', null)
            .not('status', 'in', '("draft")')
            .is('deleted_at', null)
        : Promise.resolve({ data: [] }),
    ])

  const events: string[] = []

  for (const task of tasksRes.data ?? []) {
    const due = task.due_date as string
    const proj = (task as unknown as { projects: { name: string } | null }).projects
    const summary = proj ? `[${proj.name}] ${task.title as string}` : (task.title as string)
    events.push(
      buildEvent(
        `task-${task.id as string}@doscientos`,
        summary,
        icsDateOnly(due),
        allDayEnd(due),
        (task.description as string | null) ?? undefined,
        true,
      ),
    )
  }

  for (const r of remindersRes.data ?? []) {
    const dt = r.remind_at as string
    const dtIcs = icsDate(dt)
    const endDt = new Date(dt)
    endDt.setMinutes(endDt.getMinutes() + 30)
    events.push(
      buildEvent(
        `reminder-${r.id as string}@doscientos`,
        `[Recordatorio] ${r.title as string}`,
        dtIcs,
        icsDate(endDt),
        (r.notes as string | null) ?? undefined,
        false,
      ),
    )
  }

  for (const s of subsRes.data ?? []) {
    const date = s.next_invoice_date as string
    const client = (s as unknown as { clients: { name: string } | null }).clients
    const amount = s.amount as number | null
    const desc = [
      client ? `Cliente: ${client.name}` : null,
      amount != null ? `Importe: ${amount}€` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    events.push(
      buildEvent(
        `subscription-${s.id as string}@doscientos`,
        `[Suscripción] ${s.name as string}`,
        icsDateOnly(date),
        allDayEnd(date),
        desc || undefined,
        true,
      ),
    )
  }

  for (const inv of invoicesRes.data ?? []) {
    const date = inv.due_date as string
    const client = (inv as unknown as { clients: { name: string } | null }).clients
    const total = inv.total as number | null
    const desc = [
      client ? `Cliente: ${client.name}` : null,
      total != null ? `Total: ${total}€` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    events.push(
      buildEvent(
        `invoice-${inv.id as string}@doscientos`,
        `[Factura] ${(inv.full_number as string) ?? 'Factura'}`,
        icsDateOnly(date),
        allDayEnd(date),
        desc || undefined,
        true,
      ),
    )
  }

  for (const ms of milestonesRes.data ?? []) {
    const date = ms.due_date as string
    const proj = (ms as unknown as { projects: { name: string } | null }).projects
    const desc = proj ? `Proyecto: ${proj.name}` : undefined
    events.push(
      buildEvent(
        `milestone-${ms.id as string}@doscientos`,
        `[Hito] ${ms.name as string}`,
        icsDateOnly(date),
        allDayEnd(date),
        desc,
        true,
      ),
    )
  }

  for (const p of proposalsRes.data ?? []) {
    const date = p.valid_until as string
    const client = (p as unknown as { clients: { name: string } | null }).clients
    const desc = client ? `Cliente: ${client.name}` : undefined
    events.push(
      buildEvent(
        `proposal-${p.id as string}@doscientos`,
        `[Propuesta] ${(p.title as string) ?? 'Propuesta'}`,
        icsDateOnly(date),
        allDayEnd(date),
        desc,
        true,
      ),
    )
  }

  const memberName = member.name as string
  const icsBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//doscientos//CRM//ES',
    `X-WR-CALNAME:doscientos - ${memberName}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(icsBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="doscientos-calendar.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
