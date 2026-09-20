// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DemoWelcome } from './demo-welcome'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('DemoWelcome', () => {
  afterEach(cleanup)

  it('offers safe entry points into the main demo modules', () => {
    render(<DemoWelcome />)

    expect(screen.getByText('Entorno de demostración · datos ficticios')).toBeTruthy()
    expect(screen.getByRole('link', { name: /recorrido completo/i }).getAttribute('href')).toBe('/leads')
    expect(screen.getByRole('link', { name: /explorar contactos/i }).getAttribute('href')).toBe('/clients')
  })

  it('lets the visitor preview each business stage without leaving the page', () => {
    render(<DemoWelcome />)

    fireEvent.click(screen.getByRole('button', { name: /cobrar/i }))

    expect(screen.getByText('Facturación que da tranquilidad')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir módulo Cobrar' }).getAttribute('href')).toBe('/invoices')
  })
})