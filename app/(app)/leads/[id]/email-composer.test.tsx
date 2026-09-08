import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmailComposer } from './email-composer'

const fetchMock = vi.fn()

vi.mock('../actions', () => ({
  sendEmailToLead: vi.fn(),
}))

describe('EmailComposer AI draft', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ subject: 'Una propuesta clara', body: 'Hola, este es el borrador.' }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  it("combines workflow context with the user's instructions and keeps the draft editable", async () => {
    render(
      <EmailComposer
        leadId="00000000-0000-4000-8000-000000000001"
        defaultTo="lead@example.test"
        draftInstructions="Contexto automático del flujo."
        draftInteractionId="00000000-0000-4000-8000-000000000099"
        aiEnabled
      />,
    )

    fireEvent.change(screen.getByLabelText(/¿Qué quieres que diga el email?/i), {
      target: { value: 'Destaca el ahorro de tiempo y propón una llamada breve.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generar borrador' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      lead_id: '00000000-0000-4000-8000-000000000001',
      reply_to_interaction_id: '00000000-0000-4000-8000-000000000099',
      instructions:
        'Contexto automático del flujo.\n\nDestaca el ahorro de tiempo y propón una llamada breve.',
      language: 'es',
    })

    expect(await screen.findByDisplayValue('Una propuesta clara')).toBeTruthy()
    expect(screen.getByDisplayValue('Hola, este es el borrador.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Regenerar borrador' })).toBeTruthy()
  })
})
