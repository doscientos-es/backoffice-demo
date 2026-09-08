'use client'

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Moon } from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react'

import { ErrorBoundary } from '@/components/ui/error-boundary'
import { rescheduleEvent } from '@/lib/calendar/actions'
import {
  ALL_LAYERS,
  CALENDAR_LAYER_COLORS,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarView,
} from '@/lib/calendar/types'
import { cn } from '@/lib/utils'

import { CalendarCreateDialog } from './calendar-create-dialog'
import { CalendarEventDialog } from './calendar-event-dialog'
import { CalendarHeader } from './calendar-header'
import { DayCell } from './day-cell'

// Context so EventChip/DayCell can open the detail dialog without prop drilling
const CalendarDialogContext = createContext<(e: CalendarEvent) => void>(() => undefined)
export function useCalendarDialog() {
  return useContext(CalendarDialogContext)
}

// Context so DayCell day-number can open the create dialog with a pre-selected date
const CalendarCreateContext = createContext<(date?: string) => void>(() => undefined)
export function useCalendarCreate() {
  return useContext(CalendarCreateContext)
}

export type TeamMember = {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  github_handle: string | null
}

export type LeadOption = {
  id: string
  name: string
  email: string | null
  company: string | null
  /** Distinguishes between a pipeline lead and a converted client */
  contactKind: 'lead' | 'client'
  /** For leads: same as id. For clients: client.lead_id (may be null) */
  leadId: string | null
}

export type ProjectOption = {
  id: string
  name: string
}

type Props = {
  events: CalendarEvent[]
  view: CalendarView
  anchor: string
  teamMembers: TeamMember[]
  leads: LeadOption[]
  projects: ProjectOption[]
  prevMonth: string
  nextMonth: string
  calendarToken: string | null
}

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function buildMonthGrid(anchor: Date): Date[][] {
  const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1), {
    weekStartsOn: 1,
  })
  const end = endOfWeek(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0), {
    weekStartsOn: 1,
  })
  const days = eachDayOfInterval({ start, end })
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

function buildWeekGrid(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

function groupByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const groups: Record<string, CalendarEvent[]> = {}
  for (const e of events) {
    const key = e.start.slice(0, 10)
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return groups
}

export function CalendarGrid({
  events: initial,
  view,
  anchor,
  teamMembers,
  leads,
  projects,
  prevMonth,
  nextMonth,
  calendarToken,
}: Props) {
  const anchorDate = parseISO(anchor)
  const [, startTransition] = useTransition()
  const [events, applyOptimistic] = useOptimistic(
    initial,
    (state, { id, newStart }: { id: string; newStart: string }) =>
      state.map((e) => (e.id === id ? { ...e, start: newStart, end: newStart } : e)),
  )

  // ── Detail dialog ─────────────────────────────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // ── Create dialog ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState<string | undefined>(undefined)
  const [createdEvents, setCreatedEvents] = useState<CalendarEvent[]>([])

  function openCreate(date?: string) {
    setCreateDate(date)
    setCreateOpen(true)
  }

  // ── Client-side filters ───────────────────────────────────────────────────
  const [activeLayers, setActiveLayers] = useState<Set<CalendarEventKind>>(new Set(ALL_LAYERS))
  const [activeMembers, setActiveMembers] = useState<Set<string>>(
    new Set(teamMembers.map((m) => m.id)),
  )

  function toggleLayer(layer: CalendarEventKind) {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  function toggleMember(id: string) {
    setActiveMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Optimistically removed event ids (deleted google_meetings)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  // Merge server events + locally-created optimistic events.
  // Deduplicate: once the server re-renders (after revalidatePath) the new
  // event will already be in `events`, so drop any createdEvents whose id is
  // already present to avoid duplicate React keys.
  const serverIds = new Set(events.map((e) => e.id))
  const allEvents = [...events, ...createdEvents.filter((e) => !serverIds.has(e.id))].filter(
    (e) => !deletedIds.has(e.id),
  )

  // Filter: by active layer AND member scope. Single-owner events use memberId;
  // shared events (charlas/eventos) use memberIds — visible if any attendee is active.
  const filtered = allEvents.filter((e) => {
    if (!activeLayers.has(e.kind)) return false
    if (e.memberIds && e.memberIds.length > 0) {
      return e.memberIds.some((id) => activeMembers.has(id))
    }
    return e.memberId === null || activeMembers.has(e.memberId)
  })

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const event = events.find((e) => e.id === active.id)
    if (!event?.editable) return
    const newStart = over.id as string
    const parts = (event.id as string).split(':')
    const kind = parts[0] as CalendarEventKind
    const sourceId = parts.slice(1).join(':')
    startTransition(async () => {
      applyOptimistic({ id: event.id, newStart })
      await rescheduleEvent({ kind, sourceId, newStart })
    })
  }

  const headerProps = {
    anchor,
    view,
    prevMonth,
    nextMonth,
    teamMembers,
    activeLayers,
    onToggleLayer: toggleLayer,
    activeMembers,
    onToggleMember: toggleMember,
    calendarToken,
  }

  // Shared dialogs + create button rendered once, shared across all views
  const sharedDialogs = (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div className="border-destructive/30 bg-background fixed right-4 bottom-4 z-50 max-w-xs rounded-lg border p-4 shadow-lg">
          <p className="text-destructive text-sm font-medium">Error en el diálogo</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{err.message}</p>
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground mt-2 text-xs underline"
          >
            Reintentar
          </button>
        </div>
      )}
    >
      <CalendarEventDialog
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDeleted={(id: string) => {
          setDeletedIds((prev) => new Set(prev).add(id))
          setSelectedEvent(null)
        }}
      />
      <CalendarCreateDialog
        open={createOpen}
        initialDate={createDate}
        teamMembers={teamMembers}
        leads={leads}
        projects={projects}
        onClose={() => setCreateOpen(false)}
        onCreated={(ev) => setCreatedEvents((prev) => [...prev, ev])}
      />
    </ErrorBoundary>
  )

  if (view === 'agenda') {
    return (
      <CalendarDialogContext.Provider value={setSelectedEvent}>
        <CalendarCreateContext.Provider value={openCreate}>
          {sharedDialogs}
          <div className="flex h-full flex-col">
            <CalendarHeader {...headerProps} />
            <AgendaView events={filtered} />
          </div>
        </CalendarCreateContext.Provider>
      </CalendarDialogContext.Provider>
    )
  }

  if (view === 'week') {
    const days = buildWeekGrid(anchorDate)
    return (
      <CalendarDialogContext.Provider value={setSelectedEvent}>
        <CalendarCreateContext.Provider value={openCreate}>
          {sharedDialogs}
          <div className="flex h-full min-h-0 flex-col">
            <CalendarHeader {...headerProps} />
            <WeekTimeGrid days={days} events={filtered} />
          </div>
        </CalendarCreateContext.Provider>
      </CalendarDialogContext.Provider>
    )
  }

  // Month view (default)
  const weeks = buildMonthGrid(anchorDate)
  return (
    <CalendarDialogContext.Provider value={setSelectedEvent}>
      <CalendarCreateContext.Provider value={openCreate}>
        {sharedDialogs}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex h-full flex-col">
            <CalendarHeader {...headerProps} />
            <div className="border-border grid grid-cols-7 border-b">
              {WEEK_DAYS.map((d) => (
                <div
                  key={d}
                  className="text-muted-foreground py-1.5 text-center text-xs font-medium"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="divide-border grid flex-1 grid-cols-7 grid-rows-[repeat(6,1fr)] divide-x divide-y overflow-hidden">
              {weeks.flatMap((week) =>
                week.map((d) => (
                  <DayCell
                    key={d.toISOString()}
                    day={d}
                    events={filtered.filter((e) => isSameDay(parseISO(e.start), d))}
                    isCurrentMonth={isSameMonth(d, anchorDate)}
                    isToday={isToday(d)}
                  />
                )),
              )}
            </div>
          </div>
        </DndContext>
      </CalendarCreateContext.Provider>
    </CalendarDialogContext.Provider>
  )
}

// ─── WeekTimeGrid ─────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 60 // px per hour (60 px = 1 min per px)
const TIME_COL_W = 48 // px, left column for hour labels
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const NIGHT_MORNING_END = 8 // hours 0–7 hidden by default
const NIGHT_EVENING_START = 20 // hours 20–23 hidden by default
const NIGHT_BAND_H = 28 // px, height of the collapsed toggle bar

// ─── NightBand ────────────────────────────────────────────────────────────────

function NightBand({
  expanded,
  onToggle,
  label,
  position,
}: {
  expanded: boolean
  onToggle: () => void
  label: string
  position: 'top' | 'bottom'
}) {
  // Collapsed → ChevronDown ("show more"), expanded → ChevronUp ("hide")
  const Chevron = expanded ? ChevronUp : ChevronDown

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ height: NIGHT_BAND_H }}
      className={cn(
        'flex w-full items-center justify-center gap-1.5 select-none',
        'text-[10px] text-muted-foreground hover:bg-secondary/60 transition-colors',
        'border-border',
        position === 'top' ? 'border-b' : 'border-t',
      )}
    >
      <Moon className="h-3 w-3 opacity-60" />
      <span>{label}</span>
      <Chevron className="h-3 w-3 opacity-60" />
    </button>
  )
}

// ─── WeekTimeGrid ─────────────────────────────────────────────────────────────

function WeekTimeGrid({ days, events }: { days: Date[]; events: CalendarEvent[] }) {
  const openDialog = useCalendarDialog()
  const openCreate = useCalendarCreate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [showMorningNight, setShowMorningNight] = useState(false)
  const [showEveningNight, setShowEveningNight] = useState(false)
  const [hoveredSlot, setHoveredSlot] = useState<{ dayStr: string; hour: number } | null>(null)

  // Scroll to 1 h before current time on mount; update clock every minute.
  // When morning is collapsed the visible grid starts at NIGHT_MORNING_END,
  // so we subtract those hours from the scroll offset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount only; re-running on every `now` tick would reset scroll position every minute
  useEffect(() => {
    if (scrollRef.current) {
      const morningOffset = NIGHT_MORNING_END * HOUR_HEIGHT // collapsed by default
      scrollRef.current.scrollTop = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT - morningOffset)
    }
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const todayStr = format(now, 'yyyy-MM-dd')
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT

  const allDayByDay = days.map((d) =>
    events.filter((e) => e.allDay && isSameDay(parseISO(e.start), d)),
  )
  const hasAnyAllDay = allDayByDay.some((g) => g.length > 0)

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
      {/* ── Day name headers (sticky) ──────────────────────────────────────── */}
      <div className="bg-background border-border sticky top-0 z-30 flex border-b">
        <div style={{ width: TIME_COL_W }} className="border-border shrink-0 border-r" />
        {days.map((d) => {
          const isCurrentDay = format(d, 'yyyy-MM-dd') === todayStr
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'flex-1 border-r border-border py-1.5 text-center select-none',
                isCurrentDay ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <div className="text-[10px] font-medium tracking-wide uppercase">
                {format(d, 'EEE', { locale: es })}
              </div>
              <div
                className={cn(
                  'mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                  isCurrentDay && 'bg-primary text-primary-foreground',
                )}
              >
                {format(d, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── All-day strip (sticky below day headers, h-12 = 48 px) ────────── */}
      <div
        className={cn(
          'sticky top-[84px] z-20 flex bg-background border-b border-border',
          !hasAnyAllDay && 'hidden',
        )}
      >
        <div
          style={{ width: TIME_COL_W }}
          className="border-border flex shrink-0 items-start justify-end border-r pt-1 pr-1.5"
        >
          <span className="text-muted-foreground text-right text-[9px] leading-tight">
            todo
            <br />
            el día
          </span>
        </div>
        {days.map((d, i) => (
          <div
            key={d.toISOString()}
            className="border-border flex min-h-[28px] flex-1 flex-col gap-0.5 border-r px-0.5 py-0.5"
          >
            {(allDayByDay[i] ?? []).map((e) => (
              <EventChip key={e.id} event={e} />
            ))}
          </div>
        ))}
      </div>

      {/* ── Morning night band ────────────────────────────────────────────── */}
      <NightBand
        expanded={showMorningNight}
        onToggle={() => setShowMorningNight((v) => !v)}
        label="00:00 – 08:00"
        position="top"
      />

      {/* ── Time grid (clipped to hide night hours when collapsed) ─────────── */}
      <div
        style={{
          height:
            24 * HOUR_HEIGHT -
            (!showMorningNight ? NIGHT_MORNING_END * HOUR_HEIGHT : 0) -
            (!showEveningNight ? (24 - NIGHT_EVENING_START) * HOUR_HEIGHT : 0),
          overflow: 'hidden',
        }}
      >
        <div
          className="relative flex"
          style={{
            height: 24 * HOUR_HEIGHT,
            marginTop: showMorningNight ? 0 : -NIGHT_MORNING_END * HOUR_HEIGHT,
          }}
        >
          {/* Hour labels column */}
          <div
            style={{ width: TIME_COL_W }}
            className="border-border relative shrink-0 border-r select-none"
          >
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                className="absolute inset-x-0 flex items-start justify-end pt-0.5 pr-2"
              >
                {h > 0 && (
                  <span className="text-muted-foreground -translate-y-2 text-[10px] tabular-nums">
                    {String(h).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const dayStr = format(d, 'yyyy-MM-dd')
            const isCurrentDay = dayStr === todayStr
            const timedEvs = events.filter(
              (e) => !e.allDay && e.start.length > 10 && isSameDay(parseISO(e.start), d),
            )

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only shortcut to create an event by clicking a time slot; the "Nuevo" button in the header provides a fully keyboard-accessible equivalent
              <div
                key={d.toISOString()}
                className={cn(
                  'flex-1 border-r border-border relative',
                  isCurrentDay && 'bg-primary/[0.02]',
                )}
                onClick={() => openCreate(dayStr)}
                role="presentation"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  // rect.top is in viewport coords and already reflects the negative
                  // marginTop of the inner grid, so this gives the absolute hour (0–23).
                  const absHour = Math.floor((e.clientY - rect.top) / HOUR_HEIGHT)
                  setHoveredSlot({ dayStr, hour: Math.max(0, Math.min(23, absHour)) })
                }}
                onMouseLeave={() => setHoveredSlot(null)}
              >
                {/* Hover highlight */}
                {hoveredSlot?.dayStr === dayStr && (
                  <div
                    style={{ top: hoveredSlot.hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    className="bg-muted/80 pointer-events-none absolute inset-x-0 z-[5]"
                  />
                )}

                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ top: h * HOUR_HEIGHT }}
                    className="border-border/40 pointer-events-none absolute inset-x-0 border-t"
                  />
                ))}
                {/* Half-hour dotted lines */}
                {HOURS.map((h) => (
                  <div
                    key={`${h}h`}
                    style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    className="border-border/20 pointer-events-none absolute inset-x-0 border-t border-dashed"
                  />
                ))}

                {/* Current time indicator */}
                {isCurrentDay && (
                  <div
                    style={{ top: nowTop }}
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                  >
                    <div className="h-2.5 w-2.5 shrink-0 -translate-x-1/2 rounded-full bg-red-500" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                )}

                {/* Timed events */}
                {timedEvs.map((e) => {
                  const startDt = parseISO(e.start)
                  const endDt = parseISO(e.end)
                  const startMin = startDt.getHours() * 60 + startDt.getMinutes()
                  const endMin = endDt.getHours() * 60 + endDt.getMinutes()
                  const top = (startMin / 60) * HOUR_HEIGHT
                  const height = Math.max((Math.max(endMin - startMin, 15) / 60) * HOUR_HEIGHT, 20)
                  const colors = CALENDAR_LAYER_COLORS[e.kind]
                  return (
                    <button
                      key={e.id}
                      type="button"
                      style={{ top, height, position: 'absolute', left: 2, right: 2 }}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        openDialog(e)
                      }}
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-xs font-medium text-left overflow-hidden z-10',
                        'hover:brightness-95 focus-visible:outline-none focus-visible:ring-1',
                        colors.bg,
                        colors.text,
                        e.done && 'opacity-50',
                      )}
                    >
                      <div className={cn('truncate leading-tight', e.done && 'line-through')}>
                        {e.title}
                      </div>
                      {height >= 36 && (
                        <div className="truncate text-[10px] opacity-70">
                          {format(startDt, 'HH:mm')} – {format(endDt, 'HH:mm')}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Evening night band ────────────────────────────────────────────── */}
      <NightBand
        expanded={showEveningNight}
        onToggle={() => setShowEveningNight((v) => !v)}
        label="20:00 – 00:00"
        position="bottom"
      />
    </div>
  )
}

// ─── Agenda view ─────────────────────────────────────────────────────────────

function AgendaView({ events }: { events: CalendarEvent[] }) {
  const groups = groupByDate(events)
  const dates = Object.keys(groups).sort()
  if (!dates.length) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Sin eventos en este período
      </div>
    )
  }
  return (
    <div className="divide-border flex-1 divide-y overflow-y-auto">
      {dates.map((date) => (
        <div key={date} className="flex gap-4 px-4 py-3">
          <div className="text-muted-foreground w-24 shrink-0 pt-0.5 text-sm font-medium">
            {format(parseISO(date), 'EEE d MMM', { locale: es })}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {(groups[date] ?? []).map((e) => (
              <EventChip key={e.id} event={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── EventChip ───────────────────────────────────────────────────────────────

export function EventChip({ event }: { event: CalendarEvent }) {
  const openDialog = useCalendarDialog()
  const colors = CALENDAR_LAYER_COLORS[event.kind]
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openDialog(event)
      }}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium truncate transition-opacity text-left',
        'hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        colors.bg,
        colors.text,
        event.done && 'opacity-50',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', colors.dot)} />
      <span className={cn('truncate', event.done && 'line-through')}>{event.title}</span>
      {event.meta.projectName && !event.done && (
        <span className="shrink-0 opacity-60">· {event.meta.projectName}</span>
      )}
      {event.meta.clientName && !event.meta.projectName && (
        <span className="shrink-0 opacity-60">· {event.meta.clientName}</span>
      )}
    </button>
  )
}
