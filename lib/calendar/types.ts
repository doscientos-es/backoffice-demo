export type CalendarEventKind =
  | 'task'
  | 'reminder'
  | 'subscription'
  | 'invoice_due'
  | 'invoice_paid'
  | 'proposal_expiry'
  | 'milestone'
  | 'google_meeting'
  | 'event'

export const CALENDAR_LAYER_LABELS: Record<CalendarEventKind, string> = {
  task: 'Tareas',
  reminder: 'Recordatorios',
  subscription: 'Suscripciones',
  invoice_due: 'Facturas pendientes',
  invoice_paid: 'Cobros',
  proposal_expiry: 'Propuestas',
  milestone: 'Hitos',
  google_meeting: 'Reuniones',
  event: 'Charlas y eventos',
}

export const CALENDAR_LAYER_COLORS: Record<
  CalendarEventKind,
  { bg: string; text: string; dot: string; ring: string }
> = {
  task: {
    bg: 'bg-blue-500/10 border-blue-400/40',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    ring: 'ring-blue-400',
  },
  reminder: {
    bg: 'bg-violet-500/10 border-violet-400/40',
    text: 'text-violet-700 dark:text-violet-400',
    dot: 'bg-violet-500',
    ring: 'ring-violet-400',
  },
  subscription: {
    bg: 'bg-teal-500/10 border-teal-400/40',
    text: 'text-teal-700 dark:text-teal-400',
    dot: 'bg-teal-500',
    ring: 'ring-teal-400',
  },
  invoice_due: {
    bg: 'bg-red-500/10 border-red-400/40',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    ring: 'ring-red-400',
  },
  invoice_paid: {
    bg: 'bg-green-500/10 border-green-400/40',
    text: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
    ring: 'ring-green-400',
  },
  proposal_expiry: {
    bg: 'bg-orange-500/10 border-orange-400/40',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
    ring: 'ring-orange-400',
  },
  milestone: {
    bg: 'bg-amber-500/10 border-amber-400/40',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    ring: 'ring-amber-400',
  },
  google_meeting: {
    bg: 'bg-emerald-500/10 border-emerald-400/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-400',
  },
  event: {
    bg: 'bg-fuchsia-500/10 border-fuchsia-400/40',
    text: 'text-fuchsia-700 dark:text-fuchsia-400',
    dot: 'bg-fuchsia-500',
    ring: 'ring-fuchsia-400',
  },
}

export const ALL_LAYERS: CalendarEventKind[] = [
  'task',
  'reminder',
  'subscription',
  'invoice_due',
  'invoice_paid',
  'proposal_expiry',
  'milestone',
  'google_meeting',
  'event',
]

export type CalendarEvent = {
  /** Stable id with format `${kind}:${sourceId}`. */
  id: string
  kind: CalendarEventKind
  title: string
  /** ISO date (YYYY-MM-DD) or datetime for all-day/timed events. */
  start: string
  end: string
  allDay: boolean
  /** Deep-link to the source entity, or null for non-linkable events. */
  href: string | null
  /** Whether this event can be drag-rescheduled. */
  editable: boolean
  /** True when the underlying entity is completed/done (task done, invoice paid…). */
  done: boolean
  memberId: string | null
  memberName: string | null
  /** Attendee member IDs for shared events (charlas/eventos). Used for member filtering. */
  memberIds?: string[]
  meta: {
    status?: string
    priority?: string
    projectId?: string
    projectName?: string
    clientId?: string
    clientName?: string
    leadId?: string
    leadName?: string
    description?: string
    htmlLink?: string
    meetUrl?: string
    amount?: number
    location?: string
    attendees?: string[]
  }
}

export type CalendarView = 'month' | 'week' | 'agenda'

export type TeamMemberOption = { id: string; name: string }
