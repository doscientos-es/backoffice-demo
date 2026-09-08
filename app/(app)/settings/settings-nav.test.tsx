import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// ── mocks (hoisted before imports) ──────────────────────────────────────────

vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/settings/profile'),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}))

// ── SUT (imported after mocks are in place) ──────────────────────────────────

import { usePathname } from 'next/navigation'

import { SettingsNav } from '@/app/(app)/settings/settings-nav'

// ── helpers ───────────────────────────────────────────────────────────────────

function renderNav(canManageTeam: boolean) {
  return render(<SettingsNav canManageTeam={canManageTeam} />)
}

function desktopNav(container: HTMLElement) {
  const nav = container.querySelector<HTMLElement>('nav[aria-label="Secciones de ajustes"].sticky')
  if (!nav) throw new Error('Expected the desktop settings navigation')
  return within(nav)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SettingsNav – item visibility', () => {
  it('always shows Perfil', () => {
    const { container } = renderNav(false)
    expect(desktopNav(container).getByRole('link', { name: 'Perfil' })).toBeTruthy()
  })

  it('hides Empresa when canManageTeam is false (viewer / member)', () => {
    const { container } = renderNav(false)
    expect(desktopNav(container).queryByRole('link', { name: 'Empresa' })).toBeNull()
  })

  it('shows Empresa when canManageTeam is true (admin / owner)', () => {
    const { container } = renderNav(true)
    expect(desktopNav(container).getByRole('link', { name: 'Empresa' })).toBeTruthy()
  })

  it('hides Equipo when canManageTeam is false (viewer / member)', () => {
    const { container } = renderNav(false)
    expect(desktopNav(container).queryByRole('link', { name: 'Equipo' })).toBeNull()
  })

  it('shows Equipo when canManageTeam is true (admin / owner)', () => {
    const { container } = renderNav(true)
    expect(desktopNav(container).getByRole('link', { name: 'Equipo' })).toBeTruthy()
  })

  it('renders exactly 3 links for non-admin (Perfil + Seguridad + Legal)', () => {
    const { container } = renderNav(false)
    expect(desktopNav(container).getAllByRole('link')).toHaveLength(3)
  })

  it('renders 9 links for admin after consolidating Correo', () => {
    const { container } = renderNav(true)
    expect(desktopNav(container).getAllByRole('link')).toHaveLength(9)
  })

  it('shows the consolidated Correo section for admins', () => {
    const { container } = renderNav(true)
    expect(desktopNav(container).getByRole('link', { name: 'Correo' })).toBeTruthy()
  })

  it('hides Correo when canManageTeam is false', () => {
    const { container } = renderNav(false)
    expect(desktopNav(container).queryByRole('link', { name: 'Correo' })).toBeNull()
  })

  it('shows Diagnóstico when canManageTeam is true', () => {
    const { container } = renderNav(true)
    expect(desktopNav(container).getByRole('link', { name: 'Diagnóstico' })).toBeTruthy()
  })

  it('hides Diagnóstico when canManageTeam is false', () => {
    const { container } = renderNav(false)
    expect(desktopNav(container).queryByRole('link', { name: 'Diagnóstico' })).toBeNull()
  })

  it('shows Legal y Verifactu regardless of canManageTeam', () => {
    const member = renderNav(false)
    expect(
      desktopNav(member.container).getByRole('link', { name: 'Legal y Verifactu' }),
    ).toBeTruthy()
    member.unmount()
    const admin = renderNav(true)
    expect(
      desktopNav(admin.container).getByRole('link', { name: 'Legal y Verifactu' }),
    ).toBeTruthy()
  })

  it('groups settings by account, organization, communication, system, and compliance', () => {
    const { container } = renderNav(true)
    const nav = desktopNav(container)

    expect(nav.getByRole('heading', { name: 'Mi cuenta' })).toBeTruthy()
    expect(nav.getByRole('heading', { name: 'Organización' })).toBeTruthy()
    expect(nav.getByRole('heading', { name: 'Comunicación' })).toBeTruthy()
    expect(nav.getByRole('heading', { name: 'Sistema' })).toBeTruthy()
    expect(nav.getByRole('heading', { name: 'Cumplimiento' })).toBeTruthy()
  })
})

describe('SettingsNav – active state', () => {
  it('sets aria-current=page on the active route', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/settings/profile')
    const { container } = renderNav(false)
    const perfilLink = desktopNav(container).getByRole('link', { name: /perfil/i })
    expect(perfilLink.getAttribute('aria-current')).toBe('page')
  })

  it('does not set aria-current on inactive routes', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/settings/profile')
    const { container } = renderNav(false)
    const legalLink = desktopNav(container).getByRole('link', { name: /legal/i })
    expect(legalLink.getAttribute('aria-current')).toBeNull()
  })

  it('marks /settings/company as active when on that path (admin)', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/settings/company')
    const { container } = renderNav(true)
    const nav = desktopNav(container)
    expect(nav.getByRole('link', { name: /empresa/i }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('link', { name: /perfil/i }).getAttribute('aria-current')).toBeNull()
  })
})

describe('SettingsNav – responsive layout', () => {
  it('uses a grouped, vertical sub-sidebar instead of horizontal tabs', () => {
    const { container } = renderNav(true)
    const nav = container.querySelector('nav[aria-label="Secciones de ajustes"].sticky')

    expect(nav?.className).toContain('flex-col')
    expect(nav?.className).toContain('flex')
    expect(nav?.className).not.toContain('overflow-x-auto')
    expect(nav?.parentElement?.className).toContain('sm:block')
  })

  it('keeps the sub-sidebar and mobile picker in one layout item', () => {
    const { container } = renderNav(true)
    const sidebar = container.querySelector('aside')

    expect(sidebar?.className).toContain('min-w-0')
    expect(within(sidebar as HTMLElement).getByRole('link', { name: 'Perfil' })).toBeTruthy()
  })

  it('offers a compact mobile section picker', () => {
    renderNav(true)
    expect(screen.getByRole('button', { name: 'Cambiar sección de ajustes' })).toBeTruthy()
  })

  it('shows the application version in the settings navigation', () => {
    const { container } = renderNav(true)
    expect(desktopNav(container).getByText(/^v[0-9]+\.[0-9]+\.[0-9]+$/)).toBeTruthy()
  })

  it('keeps Correo as a direct settings route', () => {
    const { container } = renderNav(true)

    expect(desktopNav(container).getByRole('link', { name: 'Correo' }).getAttribute('href')).toBe(
      '/settings/email',
    )
  })
})
