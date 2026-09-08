import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EntityMultiCombobox } from '@/components/ui/entity-multi-combobox'

const ITEMS = [
  {
    id: 'ada',
    label: 'Ada Lovelace',
    sublabel: 'CTO',
    leading: <span data-testid="ada-avatar">AL</span>,
  },
  { id: 'grace', label: 'Grace Hopper', sublabel: 'Engineering' },
]

describe('EntityMultiCombobox', () => {
  it('renders a leading visual in selected chips and keeps the remove control borderless', () => {
    render(
      <EntityMultiCombobox items={ITEMS} value={['ada']} onChange={vi.fn()} aria-label="Equipo" />,
    )

    expect(screen.getByText('Ada Lovelace')).toBeDefined()
    expect(screen.getByTestId('ada-avatar')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Quitar selección' })).toBeDefined()
  })

  it('removes a selected value through the chip control', () => {
    const onChange = vi.fn()
    render(
      <EntityMultiCombobox items={ITEMS} value={['ada']} onChange={onChange} aria-label="Equipo" />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('filters options and only shows the empty state when no option matches', () => {
    render(<EntityMultiCombobox items={ITEMS} value={[]} onChange={vi.fn()} aria-label="Equipo" />)

    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getByText('Grace Hopper')).toBeDefined()

    fireEvent.change(input, { target: { value: 'inexistente' } })

    expect(screen.queryByText('Grace Hopper')).toBeNull()
    expect(screen.getByText('No se encontraron coincidencias')).toBeDefined()
  })
})
