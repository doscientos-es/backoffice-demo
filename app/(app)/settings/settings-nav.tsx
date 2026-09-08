'use client'

import { Drawer, DrawerDescription, DrawerHeader, DrawerTitle } from '@doscientos/ui'
import {
  Activity,
  Building2,
  ChevronDown,
  Database as DatabaseBackup,
  Mail,
  Shield,
  Target,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import { version } from '../../../package.json'

type Item = {
  href: string
  label: string
  icon: typeof User
  requiresAdmin: boolean
}

type Group = {
  label: string
  items: readonly Item[]
}

const GROUPS: readonly Group[] = [
  {
    label: 'Mi cuenta',
    items: [
      { href: '/settings/profile', label: 'Perfil', icon: User, requiresAdmin: false },
      { href: '/settings/security', label: 'Seguridad', icon: Shield, requiresAdmin: false },
    ],
  },
  {
    label: 'Organización',
    items: [
      { href: '/settings/company', label: 'Empresa', icon: Building2, requiresAdmin: true },
      { href: '/settings/team', label: 'Equipo', icon: Users, requiresAdmin: true },
      { href: '/settings/goals', label: 'Objetivos', icon: Target, requiresAdmin: true },
    ],
  },
  {
    label: 'Comunicación',
    items: [{ href: '/settings/email', label: 'Correo', icon: Mail, requiresAdmin: true }],
  },
  {
    label: 'Sistema',
    items: [
      {
        href: '/settings/backups',
        label: 'Copias y exportaciones',
        icon: DatabaseBackup,
        requiresAdmin: true,
      },
      { href: '/settings/diagnostics', label: 'Diagnóstico', icon: Activity, requiresAdmin: true },
    ],
  },
  {
    label: 'Cumplimiento',
    items: [
      { href: '/settings/legal', label: 'Legal y Verifactu', icon: Shield, requiresAdmin: false },
    ],
  },
] as const

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function visibleGroups(canManageTeam: boolean) {
  return GROUPS.flatMap((group) => {
    const items = group.items.filter((item) => !item.requiresAdmin || canManageTeam)
    return items.length > 0 ? [{ ...group, items }] : []
  })
}

function SettingsLinks({
  groups,
  pathname,
  onNavigate,
}: {
  groups: ReturnType<typeof visibleGroups>
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.label} aria-labelledby={`settings-group-${group.label}`}>
          <h2
            id={`settings-group-${group.label}`}
            className="text-muted-foreground/70 px-3 pb-1.5 text-[10px] font-semibold tracking-widest uppercase"
          >
            {group.label}
          </h2>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    'before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:transition-opacity',
                    active
                      ? 'bg-secondary font-medium text-foreground before:opacity-100'
                      : 'text-muted-foreground before:opacity-0 hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

export function SettingsNav({ canManageTeam }: { canManageTeam: boolean }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const groups = visibleGroups(canManageTeam)
  const activeItem = groups
    .flatMap((group) => group.items)
    .find((item) => isActive(pathname, item.href))

  return (
    <aside className="min-w-0">
      <div className="hidden sm:block">
        <nav aria-label="Secciones de ajustes" className="sticky top-0 flex w-full flex-col gap-5">
          <SettingsLinks groups={groups} pathname={pathname} />
          <span className="text-muted-foreground px-3 text-xs">v{version}</span>
        </nav>
      </div>

      <div className="sm:hidden">
        <Drawer
          trigger={
            <button
              type="button"
              aria-label="Cambiar sección de ajustes"
              className="border-border bg-card hover:bg-secondary/60 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm shadow-sm transition-colors"
            >
              <span className="text-muted-foreground">Ajustes</span>
              <span className="text-foreground flex items-center gap-2 font-medium">
                {activeItem?.label ?? 'Secciones'}
                <ChevronDown className="text-muted-foreground size-4" aria-hidden />
              </span>
            </button>
          }
          isOpen={mobileOpen}
          onOpenChange={setMobileOpen}
          side="bottom"
          className="max-h-[80svh] overflow-y-auto"
        >
          <DrawerHeader>
            <DrawerTitle>Ajustes</DrawerTitle>
            <DrawerDescription>Elige la sección que quieres gestionar.</DrawerDescription>
          </DrawerHeader>
          <nav aria-label="Secciones de ajustes" className="flex flex-col gap-5 px-3 pb-6">
            <SettingsLinks
              groups={groups}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <span className="text-muted-foreground px-3 text-xs">v{version}</span>
          </nav>
        </Drawer>
      </div>
    </aside>
  )
}
