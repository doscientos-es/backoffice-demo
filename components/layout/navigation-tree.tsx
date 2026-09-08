'use client'

import { ChevronDown, Pin, PinOff } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import type { NavigationGroup, NavigationItem } from '@/lib/navigation/navigation'
import { mergeRecentItems, RECENTS_STORAGE_KEY, type RecentItem } from '@/lib/navigation/shortcuts'
import { cn } from '@/lib/utils'

type VisibleNavigationGroup = NavigationGroup & { items: NavigationItem[] }

export const NAVIGATION_PINS_STORAGE_KEY = 'doscientos:navigation-pins'

function readStringList(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function saveStringList(key: string, values: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // La navegación sigue funcionando si el almacenamiento no está disponible.
  }
}

function trackRecent(item: NavigationItem) {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(RECENTS_STORAGE_KEY) ?? '[]')
    const current = Array.isArray(raw) ? (raw as RecentItem[]) : []
    const next = mergeRecentItems(current, { href: item.href, label: item.label })
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // La navegación no depende de que se puedan guardar recientes.
  }
}

export function isNavigationItemActive(
  pathname: string,
  href: string,
  groups: VisibleNavigationGroup[],
) {
  if (pathname === href) return true
  if (!pathname.startsWith(`${href}/`)) return false
  return !groups.some((group) =>
    group.items.some(
      (item) =>
        item.href !== href &&
        item.href.startsWith(`${href}/`) &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    ),
  )
}

function NavigationLink({
  item,
  active,
  pinned,
  onNavigate,
  onTogglePin,
}: {
  item: NavigationItem
  active: boolean
  pinned: boolean
  onNavigate?: () => void
  onTogglePin: () => void
}) {
  const Icon = item.icon

  return (
    <div className="group relative">
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
        className={cn(
          'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 pr-8 text-sm transition-colors',
          'before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:transition-opacity',
          active
            ? 'bg-secondary text-foreground font-medium before:opacity-100'
            : 'text-muted-foreground before:opacity-0 hover:bg-secondary/60 hover:text-foreground',
        )}
      >
        <Icon
          className={cn(
            'size-4 shrink-0 transition-colors',
            active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
          )}
        />
        <span className="truncate">{item.label}</span>
      </Link>
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={`${pinned ? 'Desfijar' : 'Fijar'} ${item.label}`}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:opacity-100',
          pinned ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100',
        )}
      >
        {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
    </div>
  )
}

function NavigationSection({
  group,
  pathname,
  groups,
  pinnedHrefs,
  onNavigate,
  onTogglePin,
}: {
  group: VisibleNavigationGroup
  pathname: string
  groups: VisibleNavigationGroup[]
  pinnedHrefs: string[]
  onNavigate?: () => void
  onTogglePin: (href: string) => void
}) {
  const [open, setOpen] = useState(true)

  function toggle() {
    setOpen((current) => !current)
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group hover:bg-secondary/40 flex w-full items-center justify-between rounded-md px-2.5 py-1 text-left transition-colors"
      >
        <span className="text-muted-foreground/60 group-hover:text-muted-foreground text-[10px] font-semibold tracking-widest uppercase transition-colors select-none">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            'size-3 text-muted-foreground/40 transition-transform group-hover:text-muted-foreground',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>
      {open
        ? group.items.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              active={isNavigationItemActive(pathname, item.href, groups)}
              pinned={pinnedHrefs.includes(item.href)}
              onNavigate={() => {
                trackRecent(item)
                onNavigate?.()
              }}
              onTogglePin={() => onTogglePin(item.href)}
            />
          ))
        : null}
    </div>
  )
}

export function NavigationTree({
  groups,
  pathname,
  onNavigate,
}: {
  groups: VisibleNavigationGroup[]
  pathname: string
  onNavigate?: () => void
}) {
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([])
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const pinnedItems = items.filter((item) => pinnedHrefs.includes(item.href))

  useEffect(() => setPinnedHrefs(readStringList(NAVIGATION_PINS_STORAGE_KEY)), [])

  function togglePin(href: string) {
    setPinnedHrefs((current) => {
      const next = current.includes(href)
        ? current.filter((item) => item !== href)
        : [...current, href]
      saveStringList(NAVIGATION_PINS_STORAGE_KEY, next)
      return next
    })
  }

  return (
    <>
      {pinnedItems.length > 0 ? (
        <div className="border-border mb-3 flex flex-col gap-0.5 border-b pb-3">
          <span className="text-muted-foreground/60 px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase">
            Fijados
          </span>
          {pinnedItems.map((item) => (
            <NavigationLink
              key={item.href}
              item={item}
              active={isNavigationItemActive(pathname, item.href, groups)}
              pinned
              onNavigate={() => {
                trackRecent(item)
                onNavigate?.()
              }}
              onTogglePin={() => togglePin(item.href)}
            />
          ))}
        </div>
      ) : null}
      {groups.map((group, index) =>
        group.label ? (
          <div key={group.label} className={cn(index > 0 && 'mt-3')}>
            <NavigationSection
              group={group}
              pathname={pathname}
              groups={groups}
              pinnedHrefs={pinnedHrefs}
              onNavigate={onNavigate}
              onTogglePin={togglePin}
            />
          </div>
        ) : (
          <div key="root" className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                active={isNavigationItemActive(pathname, item.href, groups)}
                pinned={pinnedHrefs.includes(item.href)}
                onNavigate={() => {
                  trackRecent(item)
                  onNavigate?.()
                }}
                onTogglePin={() => togglePin(item.href)}
              />
            ))}
          </div>
        ),
      )}
    </>
  )
}
