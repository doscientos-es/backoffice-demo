import { fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PasskeyStatusCard } from './passkey-status-card'

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('./passkey-enrollment-form', () => ({
  PasskeyEnrollmentForm: () => <div>Formulario de biometría</div>,
}))

describe('PasskeyStatusCard', () => {
  it('opens the enrollment flow from security settings', () => {
    render(<PasskeyStatusCard configured={false} vaultPasswordSet />)

    expect(screen.getByText('Pendiente')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /configurar biometría/i }))
    expect(screen.getByText('Formulario de biometría')).toBeDefined()
  })

  it('explains the vault prerequisite without leaving the security setup flow', () => {
    render(<PasskeyStatusCard configured={false} vaultPasswordSet={false} />)

    fireEvent.click(screen.getByRole('button', { name: /configurar biometría/i }))
    expect(screen.getByText(/configura una contraseña maestra/i)).toBeDefined()
    expect(
      screen.getByRole('link', { name: /configurar contraseña maestra/i }).getAttribute('href'),
    ).toBe('/vault')
  })

  it('links to security settings when displayed elsewhere', () => {
    render(<PasskeyStatusCard configured={false} setupHref="/settings/security" />)

    expect(screen.getByRole('link', { name: /configurar biometría/i }).getAttribute('href')).toBe(
      '/settings/security',
    )
  })

  it('shows the configured state without presenting another setup CTA', () => {
    render(<PasskeyStatusCard configured vaultPasswordSet />)

    expect(screen.getByText('Configurada')).toBeDefined()
    expect(screen.queryByRole('link', { name: /configurar biometría/i })).toBeNull()
  })
})
