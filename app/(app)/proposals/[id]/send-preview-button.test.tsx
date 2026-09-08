import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({
  markProposalAsSent: vi.fn(),
  previewProposalEmail: vi.fn(),
  sendPreviewLink: vi.fn(),
}))

import { previewProposalEmail, sendPreviewLink } from '../actions'
import { SendPreviewButton } from './send-preview-button'

const ID = '494d62cb-fd56-4650-b131-9e3a927a20ad'
const loadPreview = vi.mocked(previewProposalEmail)
const send = vi.mocked(sendPreviewLink)

describe('SendPreviewButton', () => {
  beforeEach(() => {
    loadPreview.mockReset()
    send.mockReset()
    loadPreview.mockResolvedValue({
      ok: true,
      subject: 'Propuesta P-2026-0001 · Automatización comercial',
      html: '<html><body>Email de la propuesta</body></html>',
    })
    send.mockResolvedValue({
      ok: true,
      portalUrl: 'https://app.example.test/p/proposal/token',
      mocked: false,
    })
  })

  it('prellena el email del lead y muestra el email real antes de enviarlo', async () => {
    render(<SendPreviewButton id={ID} defaultEmail="lead@example.com" alreadySent={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar preview al cliente' }))

    await waitFor(() => expect(loadPreview).toHaveBeenCalledWith({ id: ID, message: undefined }))
    expect((screen.getByLabelText('Email del cliente') as HTMLInputElement).value).toBe(
      'lead@example.com',
    )
    expect(screen.getByTitle('Vista previa del email').getAttribute('srcdoc')).toBe(
      '<html><body>Email de la propuesta</body></html>',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }))

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ id: ID, to: 'lead@example.com', message: undefined }),
    )
  })
})
