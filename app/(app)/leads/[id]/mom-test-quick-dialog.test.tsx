import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateLeadMomTestSignal = vi.hoisted(() => vi.fn())

vi.mock('../actions', () => ({ updateLeadMomTestSignal }))
vi.mock('sileo', () => ({ sileo: { error: vi.fn() } }))

import { MomTestQuickDialog } from './mom-test-quick-dialog'

const initialValues = {
  real_problem: true,
  aware_problem: false,
  tried_solutions: null,
  decision_power_or_budget: true,
  accessible: false,
}

function buttonsFor(label: string) {
  const row = screen.getByText(label).closest('li')
  if (!row) throw new Error(`No se encontró la fila ${label}`)
  return within(row)
}

describe('MomTestQuickDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateLeadMomTestSignal.mockImplementation(() => new Promise<never>(() => undefined))
  })

  it('shows the answers that were already saved', () => {
    render(
      <MomTestQuickDialog
        leadId="lead-1"
        open
        onOpenChange={vi.fn()}
        initialValues={initialValues}
      />,
    )

    expect(
      buttonsFor('Problema real').getByRole('button', { name: 'Sí' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      buttonsFor('Es consciente').getByRole('button', { name: 'No' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('keeps the other rows interactive while one answer is saving', () => {
    render(
      <MomTestQuickDialog
        leadId="lead-1"
        open
        onOpenChange={vi.fn()}
        initialValues={{ ...initialValues, real_problem: null, aware_problem: null }}
      />,
    )

    fireEvent.click(buttonsFor('Problema real').getByRole('button', { name: 'Sí' }))

    expect(
      (buttonsFor('Problema real').getByRole('button', { name: 'Sí' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (buttonsFor('Es consciente').getByRole('button', { name: 'Sí' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    fireEvent.click(buttonsFor('Es consciente').getByRole('button', { name: 'Sí' }))

    expect(updateLeadMomTestSignal).toHaveBeenNthCalledWith(1, {
      leadId: 'lead-1',
      signal: 'real_problem',
      value: true,
    })
    expect(updateLeadMomTestSignal).toHaveBeenNthCalledWith(2, {
      leadId: 'lead-1',
      signal: 'aware_problem',
      value: true,
    })
  })
})
