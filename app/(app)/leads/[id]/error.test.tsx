import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LeadDetailError from './error'

describe('LeadDetailError', () => {
  it('shows a recoverable fallback for errors in a lead detail page', () => {
    const reset = vi.fn()

    render(
      <LeadDetailError
        error={Object.assign(new Error('query failed'), { digest: 'abc' })}
        reset={reset}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Error al cargar el lead' })).toBeDefined()
    expect(screen.getByText('ID: abc')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Volver a leads' }).getAttribute('href')).toBe('/leads')

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
