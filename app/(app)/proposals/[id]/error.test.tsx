import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ProposalDetailError from './error'

describe('ProposalDetailError', () => {
  it('shows a recoverable fallback for errors in a proposal detail page', () => {
    const reset = vi.fn()

    render(
      <ProposalDetailError
        error={Object.assign(new Error('query failed'), { digest: 'abc' })}
        reset={reset}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Error al cargar la propuesta' })).toBeDefined()
    expect(screen.getByText('ID: abc')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Volver a propuestas' }).getAttribute('href')).toBe(
      '/proposals',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
