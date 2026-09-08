import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PageHeader } from '@/components/layout/page-header'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Test Title" description="Test Description" />)
    expect(screen.getByText('Test Title')).toBeDefined()
    expect(screen.getByText('Test Description')).toBeDefined()
  })

  it('renders a compact eyebrow separately from a pretty title', () => {
    render(
      <PageHeader
        title="Aplicación a medida Kache Envios"
        eyebrow="P-2026-0015"
        titleClassName="text-pretty"
      />,
    )

    expect(screen.getByText('P-2026-0015').className).toContain('text-muted-foreground')
    expect(
      screen.getByRole('heading', { name: 'Aplicación a medida Kache Envios' }).className,
    ).toContain('text-pretty')
  })

  it('renders breadcrumbs when provided', () => {
    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Settings', href: '/settings' },
      { label: 'Profile' },
    ]
    render(<PageHeader title="Profile Page" breadcrumbs={breadcrumbs} />)
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Profile')).toBeDefined()
    expect(screen.getByText('Profile Page')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/')
  })

  it('renders back slot when no breadcrumbs are provided', () => {
    render(<PageHeader title="Detail" back={<span data-testid="back">Back</span>} />)
    expect(screen.getByTestId('back')).toBeDefined()
  })

  it('keeps the title area flexible when the actions are wide', () => {
    const { container } = render(
      <PageHeader
        title="Factura 2026-000006"
        actions={<button type="button">Acción extensa</button>}
      />,
    )

    expect(
      screen.getByText('Factura 2026-000006').parentElement?.parentElement?.className,
    ).toContain('sm:flex-1')
    expect(container.querySelector('header > div > div:last-child')?.className).toContain(
      'sm:max-w-1/2',
    )
  })
})
