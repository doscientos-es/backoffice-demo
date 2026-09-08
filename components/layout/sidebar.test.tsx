import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CurrentUser } from '@/lib/auth'

import { Sidebar } from './sidebar'

let pathname = '/inicio'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('@/components/branding', () => ({ Logo: () => <span>Logo</span> }))
vi.mock('@/components/layout/command-palette-trigger', () => ({
  CommandPaletteTrigger: () => <button type="button">Buscar</button>,
}))
vi.mock('@/components/layout/navigation-tree', () => ({ NavigationTree: () => <div /> }))
vi.mock('@/components/layout/notifications-bell', () => ({
  NotificationsBell: () => <button type="button" aria-label="Notificaciones" />,
}))
vi.mock('@/components/layout/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}))
vi.mock('@/components/theme-toggle', () => ({
  ThemeToggle: () => <button type="button" aria-label="Cambiar tema" />,
}))
vi.mock('@/components/ui/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/navigation/navigation', () => ({ visibleNavigationGroups: () => [] }))

const user: CurrentUser = {
  id: 'member-1',
  email: 'ana@example.com',
  name: 'Ana Pérez',
  role: 'admin',
  avatarUrl: null,
  emailAlias: null,
  githubHandle: null,
  onboardedAt: null,
  jobTitle: null,
  phone: null,
  contactEmail: null,
}

describe('Sidebar actions', () => {
  it('uses the app sidebar visibility rule for desktop navigation', () => {
    const { container } = render(<Sidebar user={user} />)

    const sidebar = container.querySelector('aside')
    expect(sidebar?.className).toContain('app-sidebar')
  })

  it('places the profile menu beside the utility actions', () => {
    render(<Sidebar user={user} />)

    const settings = screen.getByRole('link', { name: 'Ajustes' })
    const theme = screen.getByRole('button', { name: 'Cambiar tema' })
    const notifications = screen.getByRole('button', { name: 'Notificaciones' })
    expect(settings.getAttribute('href')).toBe('/settings')
    expect(settings.getAttribute('data-variant')).toBe('ghost')
    expect(settings.className).toContain('border-0')
    expect(settings.parentElement).toBe(theme.parentElement)
    expect(settings.parentElement).toBe(notifications.parentElement)
    expect(settings.parentElement).toBe(screen.getByTestId('user-menu').parentElement)
    expect(screen.queryByText(/^AEAT /)).toBeNull()
  })

  it('marks the settings icon as active in settings routes', () => {
    pathname = '/settings/profile'
    render(<Sidebar user={user} />)

    expect(screen.getByRole('link', { name: 'Ajustes' }).getAttribute('aria-current')).toBe('page')
    pathname = '/inicio'
  })
})
