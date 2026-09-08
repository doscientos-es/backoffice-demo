import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatCard } from '@/components/layout/stat-card'

describe('StatCard', () => {
  it('fills its grid cell whether or not it is linked', () => {
    const { container } = render(
      <div>
        <StatCard label="Sin enlace" value="10 €" />
        <StatCard label="Con enlace" value="20 €" href="/invoices" />
      </div>,
    )

    const cards = container.querySelectorAll('[data-slot="card"]')
    expect(cards).toHaveLength(2)
    for (const card of cards) expect(card.className).toContain('h-full')
    expect(screen.getByRole('link', { name: /con enlace/i }).className).toContain('h-full')
  })

  it('uses the small card spacing for dense summaries', () => {
    render(<StatCard label="Pendientes" value="399,30 €" density="compact" />)

    const card = screen.getByText('Pendientes').closest('[data-slot="card"]')
    expect(card?.getAttribute('data-size')).toBe('sm')
    expect(screen.getByText('399,30 €').className).toContain('text-xl')
  })

  it('keeps supporting text while using the inline density', () => {
    render(<StatCard label="Pendientes" value="399,30 €" hint="2 facturas emitidas" density="inline" />)

    const card = screen.getByText('Pendientes').closest('[data-slot="card"]')
    expect(card?.getAttribute('data-density')).toBe('inline')
    expect(card?.className).toContain('py-2')
    expect(screen.getByText('399,30 €').className).toContain('text-lg')
    expect(screen.getByText('2 facturas emitidas').getAttribute('title')).toBe('2 facturas emitidas')
  })
})
