'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { isGoogleEnabled, serverEnv } from '@/lib/env'
import { deleteEvent, insertEvent } from '@/lib/google/calendar'
import { resolveSubject } from '@/lib/google/client'
import { createServerClient } from '@/lib/supabase/server'

import { DEFAULT_MEETING_DURATION, type MeetingDuration } from './date-presets'
import type { CalendarEvent, CalendarEventKind } from './types'

export type RescheduleResult = { ok: true } | { ok: false; error: string }

/**
 * Updates the date of a draggable calendar event.
 * Only tasks (due_date) and reminders (remind_at) are editable.
 * Reminder time is preserved; only the date is shifted.
 */
export async function rescheduleEvent(opts: {
  kind: CalendarEventKind
  sourceId: string
  newStart: string // ISO date (YYYY-MM-DD) for all-day, ISO datetime for timed
}): Promise<RescheduleResult> {
  const user = await requireUser()
  const supabase = await createServerClient()

  if (opts.kind === 'task') {
    const { error } = await supabase
      .from('tasks')
      .update({ due_date: opts.newStart })
      .eq('id', opts.sourceId)
      .eq('assignee_id', user.id) // member can only move their own tasks
    if (error) return { ok: false, error: error.message }
    revalidatePath('/calendar')
    return { ok: true }
  }

  if (opts.kind === 'reminder') {
    // Fetch current remind_at to preserve time-of-day
    const { data, error: fetchError } = await supabase
      .from('reminders')
      .select('remind_at')
      .eq('id', opts.sourceId)
      .eq('created_by', user.id)
      .single()
    if (fetchError || !data) return { ok: false, error: fetchError?.message ?? 'Not found' }

    const existing = new Date(data.remind_at as string)
    const parts = opts.newStart.split('-').map(Number)
    const year = parts[0] ?? 0
    const month = parts[1] ?? 1
    const day = parts[2] ?? 1
    const newDate = new Date(existing)
    newDate.setFullYear(year, month - 1, day)

    const { error } = await supabase
      .from('reminders')
      .update({ remind_at: newDate.toISOString() })
      .eq('id', opts.sourceId)
      .eq('created_by', user.id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/calendar')
    return { ok: true }
  }

  if (opts.kind === 'event') {
    // Preserve time-of-day and duration; shift only the date.
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('start_at, end_at')
      .eq('id', opts.sourceId)
      .eq('kind', 'event')
      .single()
    if (fetchError || !data) return { ok: false, error: fetchError?.message ?? 'Not found' }

    const existingStart = new Date(data.start_at as string)
    const existingEnd = data.end_at ? new Date(data.end_at as string) : null
    const [year, month, day] = (opts.newStart.split('T')[0] ?? '').split('-').map(Number)
    if (!year || !month || !day) return { ok: false, error: 'Invalid date' }
    const newStart = new Date(existingStart)
    newStart.setFullYear(year, month - 1, day)
    const newEnd = existingEnd
      ? new Date(newStart.getTime() + (existingEnd.getTime() - existingStart.getTime()))
      : null

    const { error } = await supabase
      .from('tasks')
      .update({ start_at: newStart.toISOString(), end_at: newEnd?.toISOString() ?? null })
      .eq('id', opts.sourceId)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/calendar')
    return { ok: true }
  }

  return { ok: false, error: 'Event type is not editable' }
}

// ── Create event ──────────────────────────────────────────────────────────────

export type CreateCalendarEventInput = {
  kind: 'task' | 'reminder' | 'google_meeting' | 'event'
  title: string
  date: string // YYYY-MM-DD
  startTime?: string // HH:MM — optional for tasks, required for meetings/events
  endTime?: string // HH:MM — events only
  durationMinutes?: MeetingDuration // google_meeting only
  description?: string
  assigneeId?: string // tasks only
  withMeet?: boolean // google_meeting only
  attendeeEmails?: string[] // google_meeting only — team member emails
  location?: string // event only
  attendeeMemberIds?: string[] // event only — team_members.id list
  projectId?: string // event only — optional project association
  leadId?: string // event only — optional lead association
}

export type CreateCalendarEventResult =
  | { ok: true; event: CalendarEvent }
  | { ok: false; error: string }

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<CreateCalendarEventResult> {
  const user = await requireUser()
  const supabase = await createServerClient()

  // ── Reminder ───────────────────────────────────────────────────────────────
  if (input.kind === 'reminder') {
    const remindAt = input.startTime
      ? `${input.date}T${input.startTime}:00`
      : `${input.date}T09:00:00`
    const { data, error } = await supabase
      .from('reminders')
      .insert({
        title: input.title.trim(),
        remind_at: new Date(remindAt).toISOString(),
        notes: input.description?.trim() || null,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error || !data)
      return { ok: false, error: error?.message ?? 'No se pudo crear el recordatorio' }

    // Best-effort: push to Google Calendar so it appears in the user's calendar app
    if (isGoogleEnabled()) {
      const calendarId = serverEnv().GOOGLE_CALENDAR_ID
      if (calendarId) {
        const remindDt = new Date(remindAt)
        try {
          await insertEvent({
            subject: resolveSubject(user.email),
            calendarId,
            summary: `[Recordatorio] ${input.title.trim()}`,
            description: input.description?.trim(),
            start: remindDt,
            end: new Date(remindDt.getTime() + 30 * 60_000), // 30 min block
            extendedProperties: {
              source: 'backoffice',
              kind: 'reminder',
              sourceId: data.id as string,
            },
          })
        } catch {
          // Non-fatal: reminder already saved in Supabase
        }
      }
    }

    revalidatePath('/calendar')
    revalidatePath('/reminders')
    return {
      ok: true,
      event: {
        id: `reminder:${data.id as string}`,
        kind: 'reminder',
        title: input.title.trim(),
        start: remindAt,
        end: remindAt,
        allDay: !input.startTime,
        href: null,
        editable: true,
        done: false,
        memberId: user.id,
        memberName: user.name,
        meta: { description: input.description?.trim() },
      },
    }
  }

  // ── Task ───────────────────────────────────────────────────────────────────
  if (input.kind === 'task') {
    const assigneeId = input.assigneeId ?? user.id
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        kind: 'task',
        status: 'todo',
        priority: 'medium',
        due_date: input.date,
        assignee_id: assigneeId,
        created_by: user.id,
        kanban_order: 'm',
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo crear la tarea' }

    // Best-effort: push to Google Calendar as an all-day event on the due date
    if (isGoogleEnabled()) {
      const calendarId = serverEnv().GOOGLE_CALENDAR_ID
      if (calendarId) {
        const dueDt = new Date(`${input.date}T00:00:00`)
        try {
          await insertEvent({
            subject: resolveSubject(user.email),
            calendarId,
            summary: `[Tarea] ${input.title.trim()}`,
            description: input.description?.trim(),
            start: dueDt,
            end: dueDt,
            allDay: true,
            extendedProperties: { source: 'backoffice', kind: 'task', sourceId: data.id as string },
          })
        } catch {
          // Non-fatal: task already saved in Supabase
        }
      }
    }

    revalidatePath('/calendar')
    revalidatePath('/tasks')
    return {
      ok: true,
      event: {
        id: `task:${data.id as string}`,
        kind: 'task',
        title: input.title.trim(),
        start: input.date,
        end: input.date,
        allDay: true,
        href: `/tasks/${data.id as string}`,
        editable: assigneeId === user.id,
        done: false,
        memberId: assigneeId,
        memberName: assigneeId === user.id ? user.name : null,
        meta: { description: input.description?.trim() },
      },
    }
  }

  // ── Google Meeting ─────────────────────────────────────────────────────────
  if (input.kind === 'google_meeting') {
    if (!isGoogleEnabled()) return { ok: false, error: 'Google Workspace no configurado' }
    const calendarId = serverEnv().GOOGLE_CALENDAR_ID
    if (!calendarId) return { ok: false, error: 'GOOGLE_CALENDAR_ID no configurado' }

    const startStr = `${input.date}T${input.startTime ?? '10:00'}:00`
    const startDt = new Date(startStr)
    const durationMinutes = input.durationMinutes ?? DEFAULT_MEETING_DURATION
    const endDt = new Date(startDt.getTime() + durationMinutes * 60_000)

    try {
      const inserted = await insertEvent({
        subject: resolveSubject(user.email),
        calendarId,
        summary: input.title.trim(),
        description: input.description?.trim(),
        start: startDt,
        end: endDt,
        withMeet: input.withMeet,
        attendees: input.attendeeEmails,
      })
      revalidatePath('/calendar')
      return {
        ok: true,
        event: {
          id: `google_meeting:${inserted.id}`,
          kind: 'google_meeting',
          title: input.title.trim(),
          start: startDt.toISOString(),
          end: endDt.toISOString(),
          allDay: false,
          href: inserted.htmlLink,
          editable: false,
          done: false,
          memberId: null,
          memberName: null,
          meta: {
            meetUrl: inserted.meetUrl ?? undefined,
            description: input.description?.trim(),
          },
        },
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error de Google Calendar' }
    }
  }

  // ── Event (charla/evento) — stored as tasks with kind='event' ──────────────
  if (input.kind === 'event') {
    const allDay = !input.startTime
    const startAt = allDay ? `${input.date}T00:00:00` : `${input.date}T${input.startTime}:00`
    const endAt = input.endTime ? `${input.date}T${input.endTime}:00` : null

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        kind: 'event',
        title: input.title.trim(),
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at: endAt ? new Date(endAt).toISOString() : null,
        all_day: allDay,
        project_id: input.projectId || null,
        lead_id: input.leadId || null,
        status: 'todo',
        priority: 'medium',
        kanban_order: 'm',
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo crear el evento' }

    const memberIds = input.attendeeMemberIds ?? []
    let attendeeNames: string[] = []
    if (memberIds.length > 0) {
      await supabase
        .from('task_members')
        .insert(memberIds.map((memberId) => ({ task_id: data.id as string, member_id: memberId })))
      const { data: members } = await supabase
        .from('team_members')
        .select('id, name')
        .in('id', memberIds)
      attendeeNames = (members ?? []).map((m) => m.name as string)
    }

    revalidatePath('/calendar')
    return {
      ok: true,
      event: {
        id: `event:${data.id as string}`,
        kind: 'event',
        title: input.title.trim(),
        start: allDay ? input.date : new Date(startAt).toISOString(),
        end: allDay
          ? input.date
          : endAt
            ? new Date(endAt).toISOString()
            : new Date(startAt).toISOString(),
        allDay,
        href: null,
        editable: true,
        done: false,
        memberId: null,
        memberName: null,
        memberIds,
        meta: {
          description: input.description?.trim(),
          location: input.location?.trim(),
          attendees: attendeeNames,
        },
      },
    }
  }

  return { ok: false, error: 'Tipo no válido' }
}

// ── Delete event ───────────────────────────────────────────────────────────────

export type DeleteCalendarEventResult = { ok: true } | { ok: false; error: string }

/**
 * Elimina una reunión de Google Calendar.
 * Solo funciona con eventos de tipo `google_meeting:{googleEventId}`.
 */
export async function deleteCalendarEvent(
  eventCompositeId: string,
): Promise<DeleteCalendarEventResult> {
  const user = await requireUser()

  const [kind, ...rest] = eventCompositeId.split(':')
  if (kind !== 'google_meeting' || rest.length === 0) {
    return { ok: false, error: 'Solo se pueden eliminar reuniones de Google Calendar' }
  }
  const googleEventId = rest.join(':')

  if (!isGoogleEnabled()) return { ok: false, error: 'Google Workspace no configurado' }
  const calendarId = serverEnv().GOOGLE_CALENDAR_ID
  if (!calendarId) return { ok: false, error: 'GOOGLE_CALENDAR_ID no configurado' }

  try {
    await deleteEvent({
      subject: resolveSubject(user.email),
      calendarId,
      eventId: googleEventId,
    })
    revalidatePath('/calendar')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error eliminando evento' }
  }
}
