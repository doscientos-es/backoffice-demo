import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CurrentUser } from '@/lib/auth'

import { MobileNav } from './mobile-nav'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/inicio' }))
vi.mock('@/components/branding', () => ({ Logo: () => <span>Logo</span> }))
vi.mock('@/components/layout/navigation-tree', () => ({ NavigationTree: () => <div /> }))
vi.mock('@/components/layout/notifications-bell', () => ({
  NotificationsBell: () => <button type="button" />,
}))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => <button type="button" /> }))
vi.mock('@/components/ui/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/layout/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
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

describe('MobileNav actions', () => {
  it('uses the app mobile visibility rule for the hamburger navigation', () => {
    const { container } = render(<MobileNav user={user} />)

    expect(container.firstElementChild?.className).toContain('app-mobile-nav')
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy()
  })

  it('opens the drawer when the hamburger button is clicked', () => {
    render(<MobileNav user={user} />)

    const trigger = screen.getByRole('button', { name: 'Abrir menú' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('places the profile menu beside Settings', () => {
    render(<MobileNav user={user} />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))

    const settings = screen.getByRole('link', { name: 'Ajustes' })
    expect(settings.parentElement).toBe(screen.getByTestId('user-menu').parentElement)
  })
})
