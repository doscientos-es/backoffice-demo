import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  submitProjectRequest: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('./actions', () => ({
  submitProjectRequest: mocks.submitProjectRequest,
}))

import { ProjectRequestDialog, ProjectRequestForm } from './request-form'

describe('ProjectRequestForm', () => {
  beforeEach(() => {
    mocks.refresh.mockReset()
    mocks.submitProjectRequest.mockReset().mockResolvedValue({ ok: true })
  })

  it('exposes clear, accessible fields for a public client request', () => {
    render(<ProjectRequestForm token="portal-token" />)

    expect(screen.getByRole('form', { name: 'Nueva solicitud' })).toBeTruthy()
    expect(screen.getByLabelText('Nombre')).toHaveProperty('required', true)
    expect(screen.getByLabelText(/Email/)).toHaveProperty('required', false)
    expect(screen.getByLabelText('¿En qué podemos ayudarte?')).toBeTruthy()
    expect(screen.getByLabelText('Asunto')).toHaveProperty('required', true)
    expect(screen.getByLabelText('Descripción')).toHaveProperty('required', true)
  })

  it('keeps the form hidden in the portal until requested', () => {
    render(<ProjectRequestDialog token="portal-token" />)

    expect(screen.queryByRole('form', { name: 'Nueva solicitud' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }))
    expect(screen.getByRole('dialog', { name: 'Nueva solicitud' })).toBeTruthy()
    expect(screen.getByRole('form', { name: 'Nueva solicitud' })).toBeTruthy()
  })

  it('submits the selected request and refreshes its history', async () => {
    render(<ProjectRequestForm token="portal-token" />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('¿En qué podemos ayudarte?'), {
      target: { value: 'change' },
    })
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Nuevo texto' } })
    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: 'Necesitamos actualizar la portada.' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Nueva solicitud' }))

    await waitFor(() => expect(mocks.submitProjectRequest).toHaveBeenCalledOnce())
    expect(mocks.submitProjectRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'portal-token',
        category: 'change',
        requesterName: 'Ana',
        subject: 'Nuevo texto',
      }),
    )
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(screen.getByText('Solicitud enviada correctamente')).toBeTruthy()
  })
})
