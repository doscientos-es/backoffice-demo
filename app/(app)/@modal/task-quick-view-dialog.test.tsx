import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskQuickViewDialog } from './task-quick-view-dialog'

const back = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
}))

describe('TaskQuickViewDialog', () => {
  it('shows the complete task context and keeps a dedicated-page link', () => {
    render(
      <TaskQuickViewDialog taskId="task-1">
        <p>Descripción y comentarios de la tarea</p>
      </TaskQuickViewDialog>,
    )

    expect(screen.getByRole('dialog', { name: 'Detalle de tarea' })).toBeTruthy()
    expect(screen.getByText('Descripción y comentarios de la tarea')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Abrir página completa/ }).getAttribute('href')).toBe(
      '/tasks/task-1',
    )
  })

  it('returns to the underlying page when closed', () => {
    back.mockClear()
    render(
      <TaskQuickViewDialog taskId="task-1">
        <p>Contenido</p>
      </TaskQuickViewDialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de tarea' }))

    expect(back).toHaveBeenCalledOnce()
  })
})
