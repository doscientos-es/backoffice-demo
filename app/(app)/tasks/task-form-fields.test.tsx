import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TaskFormFields } from './task-form-fields'

describe('TaskFormFields client visibility', () => {
  it('enables client visibility by default and keeps the toggle editable', () => {
    const { container } = render(
      <form>
        <TaskFormFields />
      </form>,
    )
    const toggle = screen.getByRole('checkbox', { name: /Visible en el portal del cliente/i })

    expect(toggle).toHaveProperty('checked', true)
    fireEvent.click(toggle)
    expect(toggle).toHaveProperty('checked', false)
    expect(new FormData(container.querySelector('form')!).get('is_client_visible')).toBeNull()
  })

  it('respects an explicitly private task when editing', () => {
    render(
      <form>
        <TaskFormFields defaults={{ is_client_visible: false }} />
      </form>,
    )

    expect(
      screen.getByRole('checkbox', { name: /Visible en el portal del cliente/i }),
    ).toHaveProperty('checked', false)
  })

  it('keeps optional client-facing content separate from internal description', () => {
    render(
      <form>
        <TaskFormFields
          defaults={{
            title: 'Título interno',
            description: 'Notas privadas',
            client_title: 'Título compartido',
            client_summary: 'Resumen compartido',
          }}
        />
      </form>,
    )

    expect(screen.getByLabelText('Título para cliente')).toHaveProperty(
      'value',
      'Título compartido',
    )
    expect(screen.getByLabelText('Resumen para cliente')).toHaveProperty(
      'value',
      'Resumen compartido',
    )
  })
})
