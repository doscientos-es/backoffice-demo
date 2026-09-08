/**
 * Agenda de leads vía Google Calendar (service account, domain-wide delegation).
 *
 * Flujo en dos pasos:
 *  1. `findConflicts` — lista eventos solapados con la franja propuesta.
 *  2. `insertEvent`   — crea el evento (con Meet) una vez el equipo confirma.
 */
import { GOOGLE_SCOPES, googleFetch } from './client'

const BASE = 'https://www.googleapis.com/calendar/v3/calendars'

/** Evento mínimo devuelto por events.list para detectar conflictos. */
export type CalendarBusySlot = {
  id: string
  summary: string | null
  start: string | null
  end: string | null
}

type EventsListResponse = {
  items?: Array<{
    id: string
    summary?: string
    status?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
  }>
}

/**
 * Devuelve los eventos del `calendarId` que solapan [start, end). Usa
 * `singleEvents` para expandir recurrencias y excluye cancelados.
 */
export async function findConflicts(opts: {
  subject: string
  calendarId: string
  start: Date
  end: Date
}): Promise<CalendarBusySlot[]> {
  const params = new URLSearchParams({
    timeMin: opts.start.toISOString(),
    timeMax: opts.end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  })
  const url = `${BASE}/${encodeURIComponent(opts.calendarId)}/events?${params}`
  const data = await googleFetch<EventsListResponse>(opts.subject, [GOOGLE_SCOPES.calendar], url)

  return (data.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
    }))
}

export type InsertEventInput = {
  subject: string
  calendarId: string
  summary: string
  description?: string
  start: Date
  end: Date
  /** Zona horaria IANA, p.ej. "Europe/Madrid". */
  timeZone?: string
  /** Emails de invitados (lead, equipo). */
  attendees?: string[]
  /** Si true, adjunta un enlace de Google Meet al evento. */
  withMeet?: boolean
  /** Si true, crea un evento de día completo (usa date en lugar de dateTime). */
  allDay?: boolean
  /** Propiedades privadas extendidas (k/v). Úsalas para taggear origen del evento. */
  extendedProperties?: Record<string, string>
}

export type InsertedEvent = { id: string; htmlLink: string | null; meetUrl: string | null }

export type GoogleCalendarEvent = {
  id: string
  summary: string | null
  description: string | null
  start: string | null
  end: string | null
  allDay: boolean
  htmlLink: string | null
  hangoutLink: string | null
}

type FullEventsListResponse = {
  items?: Array<{
    id: string
    summary?: string
    description?: string
    status?: string
    htmlLink?: string
    hangoutLink?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
    extendedProperties?: { private?: Record<string, string> }
  }>
}

/**
 * Lists all non-cancelled events in a calendar within [timeMin, timeMax).
 * Expands recurring events. Used for the calendar view's "Reuniones" layer.
 */
export async function listEvents(opts: {
  subject: string
  calendarId: string
  timeMin: Date
  timeMax: Date
}): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: opts.timeMin.toISOString(),
    timeMax: opts.timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const url = `${BASE}/${encodeURIComponent(opts.calendarId)}/events?${params}`
  const data = await googleFetch<FullEventsListResponse>(
    opts.subject,
    [GOOGLE_SCOPES.calendar],
    url,
  )
  return (data.items ?? [])
    .filter(
      (e) => e.status !== 'cancelled' && e.extendedProperties?.private?.source !== 'backoffice',
    )
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? null,
      description: e.description ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      allDay: !e.start?.dateTime,
      htmlLink: e.htmlLink ?? null,
      hangoutLink: e.hangoutLink ?? null,
    }))
}

/** Crea un evento en el calendario indicado. Lanza si la API falla. */
export async function insertEvent(input: InsertEventInput): Promise<InsertedEvent> {
  const tz = input.timeZone ?? 'Europe/Madrid'

  // All-day events use `date` (YYYY-MM-DD); timed events use `dateTime` + timeZone.
  const startField = input.allDay
    ? { date: input.start.toISOString().slice(0, 10) }
    : { dateTime: input.start.toISOString(), timeZone: tz }
  const endField = input.allDay
    ? { date: new Date(input.end.getTime() + 86_400_000).toISOString().slice(0, 10) }
    : { dateTime: input.end.toISOString(), timeZone: tz }

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: startField,
    end: endField,
  }

  if (input.extendedProperties && Object.keys(input.extendedProperties).length) {
    body.extendedProperties = { private: input.extendedProperties }
  }
  if (input.attendees?.length) {
    body.attendees = input.attendees.map((email) => ({ email }))
  }
  if (input.withMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `doscientos-${Date.now().toString(36)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  // "externalOnly" → only external (non-Workspace-domain) attendees receive invite
  // emails; internal @doscientos.es members already see the event on the shared
  // group calendar, so "all" would send them a duplicate notification.
  const params = new URLSearchParams({ sendUpdates: 'externalOnly' })
  if (input.withMeet) params.set('conferenceDataVersion', '1')
  const url = `${BASE}/${encodeURIComponent(input.calendarId)}/events?${params}`

  const data = await googleFetch<{
    id: string
    htmlLink?: string
    hangoutLink?: string
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>
    }
  }>(input.subject, [GOOGLE_SCOPES.calendar], url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    id: data.id,
    htmlLink: data.htmlLink ?? null,
    meetUrl:
      data.hangoutLink ??
      data.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === 'video')
        ?.uri ??
      null,
  }
}

/** Elimina un evento del calendario. Solo notifica a asistentes externos. */
export async function deleteEvent(opts: {
  subject: string
  calendarId: string
  eventId: string
}): Promise<void> {
  const params = new URLSearchParams({ sendUpdates: 'externalOnly' })
  const url = `${BASE}/${encodeURIComponent(opts.calendarId)}/events/${encodeURIComponent(opts.eventId)}?${params}`
  await googleFetch<null>(opts.subject, [GOOGLE_SCOPES.calendar], url, { method: 'DELETE' })
}
