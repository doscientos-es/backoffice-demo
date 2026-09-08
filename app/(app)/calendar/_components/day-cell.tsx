'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import { format } from 'date-fns'

import type { CalendarEvent } from '@/lib/calendar/types'
import { cn } from '@/lib/utils'

import { EventChip, useCalendarCreate } from './calendar-grid'

type DayCellProps = {
  day: Date
  events: CalendarEvent[]
  isCurrentMonth: boolean
  isToday: boolean
}

const MAX_VISIBLE = 3

export function DayCell({ day, events, isCurrentMonth, isToday }: DayCellProps) {
  const isoDate = format(day, 'yyyy-MM-dd')
  const { setNodeRef, isOver } = useDroppable({ id: isoDate })
  const openCreate = useCalendarCreate()

  const visible = events.slice(0, MAX_VISIBLE)
  const overflow = events.length - MAX_VISIBLE

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only quick-create convenience; the "+" button below is the accessible equivalent
    <div
      ref={setNodeRef}
      onClick={() => openCreate(isoDate)}
      className={cn(
        'flex flex-col gap-1 p-1.5 min-h-22.5 transition-colors cursor-pointer',
        isOver && 'bg-secondary/60',
        !isCurrentMonth && 'opacity-40',
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openCreate(isoDate)
        }}
        aria-label={`Crear evento el ${isoDate}`}
        className={cn(
          'flex h-6 w-6 items-center justify-center self-end rounded-full text-xs font-medium transition-colors',
          isToday
            ? 'bg-primary text-primary-foreground hover:bg-primary/80'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
      >
        {format(day, 'd')}
      </button>
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {visible.map((e) =>
          e.editable ? <DraggableChip key={e.id} event={e} /> : <EventChip key={e.id} event={e} />,
        )}
        {overflow > 0 && (
          <span className="text-muted-foreground pl-1 text-[10px]">+{overflow} más</span>
        )}
      </div>
    </div>
  )
}

function DraggableChip({ event }: { event: CalendarEvent }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: event.id })
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role/tabIndex/keyboard handling supplied by dnd-kit's {...attributes}/{...listeners}
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => e.stopPropagation()}
      className={cn('touch-none cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
    >
      <EventChip event={event} />
    </div>
  )
}
