import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CurrentUser } from '@/lib/auth'

import { UserMenu } from './user-menu'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } }),
}))
vi.mock('@/lib/utils', () => ({ memberAvatarUrl: () => null }))

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

describe('UserMenu', () => {
  it('renders a borderless circular trigger with only the avatar fallback', () => {
    render(<UserMenu user={user} />)

    const trigger = screen.getByRole('button', { name: 'Menú de usuario' })
    expect(trigger.className).toContain('rounded-full')
    expect(trigger.className).toContain('border-0')
    expect(trigger.textContent).toBe('AP')
  })

  it('offers direct links to the relevant account areas', async () => {
    render(<UserMenu user={user} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Menú de usuario' }), {
      button: 0,
      ctrlKey: false,
    })

    const profile = (await screen.findByText('Mi perfil')).closest('a')
    const security = screen.getByText('Seguridad').closest('a')
    const team = screen.getByText('Equipo').closest('a')
    expect(profile?.getAttribute('href')).toBe('/settings/profile')
    expect(security?.getAttribute('href')).toBe('/settings/security')
    expect(team?.getAttribute('href')).toBe('/settings/team')
  })
})
