'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, ChevronLeft, ChevronRight, Copy, Plus, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CalendarEventKind, CalendarView } from '@/lib/calendar/types'
import { ALL_LAYERS, CALENDAR_LAYER_COLORS, CALENDAR_LAYER_LABELS } from '@/lib/calendar/types'
import { cn, memberAvatarUrl } from '@/lib/utils'

import type { TeamMember } from './calendar-grid'
import { useCalendarCreate } from './calendar-grid'

type Props = {
  anchor: string
  view: CalendarView
  prevMonth: string
  nextMonth: string
  teamMembers: TeamMember[]
  activeLayers: Set<CalendarEventKind>
  onToggleLayer: (l: CalendarEventKind) => void
  activeMembers: Set<string>
  onToggleMember: (id: string) => void
  calendarToken: string | null
}

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'agenda', label: 'Agenda' },
]

function navHref(params: URLSearchParams, overrides: Record<string, string>): string {
  const next = new URLSearchParams(params)
  for (const [k, v] of Object.entries(overrides)) next.set(k, v)
  return `/calendar?${next.toString()}`
}

function memberInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
}

export function CalendarHeader({
  anchor,
  view,
  prevMonth,
  nextMonth,
  teamMembers,
  activeLayers,
  onToggleLayer,
  activeMembers,
  onToggleMember,
  calendarToken,
}: Props) {
  const openCreate = useCalendarCreate()
  const anchorDate = parseISO(anchor)
  const sp = useSearchParams()
  const [copied, setCopied] = useState(false)

  function handleCopyIcal() {
    if (!calendarToken) return
    const url = `${window.location.origin}/api/calendar/${calendarToken}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const title =
    view === 'week'
      ? `Semana del ${format(anchorDate, 'd MMM yyyy', { locale: es })}`
      : format(anchorDate, 'MMMM yyyy', { locale: es })

  const prevAnchor = parseISO(prevMonth).toISOString().slice(0, 10)
  const nextAnchor = parseISO(nextMonth).toISOString().slice(0, 10)

  return (
    <div className="border-border flex flex-col border-b">
      {/* ── Row 1: navigation + view controls ─────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        {/* Left: arrows + title */}
        <div className="flex items-center gap-1">
          <Link
            href={navHref(sp, { date: prevAnchor })}
            className="hover:bg-secondary rounded p-1 transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="w-36 text-center text-sm font-semibold capitalize">{title}</h1>
          <Link
            href={navHref(sp, { date: nextAnchor })}
            className="hover:bg-secondary rounded p-1 transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Right: Nuevo + Google Calendar + Today + view selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreate()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </button>
          {calendarToken && (
            <button
              type="button"
              onClick={handleCopyIcal}
              title="Copiar URL para Google Calendar / Apple Calendar"
              className="border-border hover:bg-secondary flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? '¡Copiado!' : 'Suscribirse'}
            </button>
          )}
          <Link
            href={navHref(sp, { date: new Date().toISOString().slice(0, 10) })}
            className="border-border hover:bg-secondary rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
          >
            Hoy
          </Link>
          <div className="border-border flex overflow-hidden rounded-md border text-xs font-medium">
            {VIEWS.map(({ value, label }) => (
              <Link
                key={value}
                href={navHref(sp, { view: value })}
                className={cn(
                  'px-2.5 py-1 transition-colors',
                  view === value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-muted-foreground',
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: layer filter dropdown + member avatars ──────── */}
      <div className="bg-muted/30 flex items-center gap-2 px-4 py-1.5">
        <LayersDropdown activeLayers={activeLayers} onToggleLayer={onToggleLayer} />

        {teamMembers.length > 1 && (
          <>
            <span className="bg-border mx-1 h-3.5 w-px" />
            {teamMembers.map((m) => {
              const active = activeMembers.has(m.id)
              const avatarSrc = memberAvatarUrl({
                avatarUrl: m.avatar_url,
                githubHandle: m.github_handle,
              })
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggleMember(m.id)}
                  title={m.name}
                  className={cn(
                    'shrink-0 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background opacity-100'
                      : 'opacity-35 hover:opacity-60',
                  )}
                >
                  <Avatar className="h-6 w-6">
                    {avatarSrc && <AvatarImage src={avatarSrc} alt={m.name} />}
                    <AvatarFallback className="text-[10px] font-semibold">
                      {memberInitials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ─── LayersDropdown ───────────────────────────────────────────────────────────

function LayersDropdown({
  activeLayers,
  onToggleLayer,
}: {
  activeLayers: Set<CalendarEventKind>
  onToggleLayer: (l: CalendarEventKind) => void
}) {
  const hiddenCount = ALL_LAYERS.length - activeLayers.size

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="border-border hover:bg-secondary focus-visible:ring-ring flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
          Tipos
          {hiddenCount > 0 && (
            <span className="bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {hiddenCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuLabel>Tipos de evento</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_LAYERS.map((layer) => {
          const c = CALENDAR_LAYER_COLORS[layer]
          return (
            <DropdownMenuCheckboxItem
              key={layer}
              checked={activeLayers.has(layer)}
              onCheckedChange={() => onToggleLayer(layer)}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', c.dot)} />
              {CALENDAR_LAYER_LABELS[layer]}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
