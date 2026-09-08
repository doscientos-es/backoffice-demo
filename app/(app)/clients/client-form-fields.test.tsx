import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({ validateVat: vi.fn() }))

import { ClientFormFields } from './client-form-fields'

describe('ClientFormFields', () => {
  it('prioritizes essential fields and keeps optional values when details are collapsed', () => {
    const { container } = render(
      <form>
        <ClientFormFields
          defaults={{
            name: 'Acme S.L.',
            label: 'Acme',
            contact_person: 'Ana García',
            notes: 'Pago a 30 días',
          }}
        />
      </form>,
    )

    const detailsButton = screen.getByRole('button', { name: /más datos de cliente/i })
    expect(detailsButton.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(detailsButton)

    expect(detailsButton.getAttribute('aria-expanded')).toBe('false')
    const form = container.querySelector('form')
    expect(new FormData(form!).get('label')).toBe('Acme')
    expect(new FormData(form!).get('contact_person')).toBe('Ana García')
    expect(new FormData(form!).get('notes')).toBe('Pago a 30 días')
  })
})
