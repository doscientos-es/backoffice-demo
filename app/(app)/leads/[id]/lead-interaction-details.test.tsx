import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LeadInteractionDetails } from './lead-interaction-details'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ sendEmailToLead: vi.fn() }))

describe('LeadInteractionDetails', () => {
  it('opens a received email with its complete multiline body and delivery metadata', () => {
    render(
      <LeadInteractionDetails
        label="Email recibido"
        leadId="00000000-0000-4000-8000-000000000001"
        leadEmail="fallback@example.test"
        canReply
        aiEnabled
        interaction={{
          id: 'interaction-1',
          type: 'email_received',
          subject: 'Necesito más información',
          body: 'Primera línea\nSegunda línea completa',
          created_at: '2026-08-24T10:00:00.000Z',
          performer: null,
          payload: { from: 'Ana <lead@example.test>', to: 'ventas@example.test' },
          resend_email_id: null,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Necesito más información')).toBeTruthy()
    expect(
      screen.getByText(
        (_, element) => element?.textContent === 'Primera línea\nSegunda línea completa',
      ),
    ).toBeTruthy()
    expect(screen.getByText(/lead@example\.test/)).toBeTruthy()
    expect(screen.getByText('ventas@example.test')).toBeTruthy()
    expect(screen.getByText('Detalles')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

    expect(screen.getByDisplayValue('lead@example.test')).toBeTruthy()
    expect(screen.getByDisplayValue('Re: Necesito más información')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Generar borrador' })).toBeTruthy()
  })
})
