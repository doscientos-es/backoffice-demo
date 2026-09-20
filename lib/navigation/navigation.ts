import {
  Archive,
  ChartBar as BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  FileText as FileSignature,
  Folder as FolderKanban,
  Globe,
  House as Home,
  Images,
  Inbox,
  Key as KeyRound,
  LifeBuoy,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react'
import type { ComponentType } from 'react'

import type { MemberRole } from '@/lib/auth'

export type NavigationItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  allowedRoles?: MemberRole[]
}

export type NavigationGroup = {
  label?: string
  items: NavigationItem[]
}

const ADMIN_ROLES: MemberRole[] = ['owner', 'admin']

/** Single source of truth for sidebar, mobile drawer and command palette. */
export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    items: [{ href: '/inicio', label: 'Inicio', icon: Home }],
  },
  {
    label: 'Trabajo diario',
    items: [
      { href: '/calendar', label: 'Agenda', icon: CalendarDays },
      { href: '/tasks', label: 'Tareas', icon: CheckSquare },
      { href: '/reminders', label: 'Recordatorios', icon: Bell },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/leads', label: 'Leads', icon: Inbox },
      { href: '/leads/recovery', label: 'Repesca', icon: LifeBuoy },
      { href: '/clients', label: 'Clientes', icon: Users },
      { href: '/proposals', label: 'Propuestas', icon: FileSignature },
    ],
  },
  {
    label: 'Entrega',
    items: [
      { href: '/projects', label: 'Proyectos', icon: FolderKanban },
      { href: '/webs', label: 'Webs', icon: Globe, allowedRoles: ADMIN_ROLES },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/invoices', label: 'Facturas', icon: Receipt, allowedRoles: ADMIN_ROLES },
      { href: '/finance', label: 'Finanzas', icon: Wallet, allowedRoles: ADMIN_ROLES },
      {
        href: '/finance/portfolio',
        label: 'Portfolio',
        icon: BarChart3,
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
  {
    label: 'Espacio de trabajo',
    items: [
      { href: '/internal-docs', label: 'Docs internos', icon: Archive },
      { href: '/brand', label: 'Marca', icon: Images },
      { href: '/settings/team', label: 'Equipo', icon: Users, allowedRoles: ADMIN_ROLES },
      { href: '/vault', label: 'Bóveda', icon: KeyRound, allowedRoles: ADMIN_ROLES },
    ],
  },
]

export function visibleNavigationGroups(role: MemberRole) {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role)),
  })).filter((group) => group.items.length > 0)
}
