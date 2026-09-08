import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  completePasskeyAuthentication,
  grantUserVerificationFromMfa,
  preparePasskeyAuthentication,
  sendToAeat,
} = vi.hoisted(() => ({
  completePasskeyAuthentication: vi.fn(),
  grantUserVerificationFromMfa: vi.fn(),
  preparePasskeyAuthentication: vi.fn(),
  sendToAeat: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => ({ sendToAeat }))
vi.mock('@/lib/security/webauthn-client', () => ({
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
}))
vi.mock('@/lib/security/webauthn-actions', () => ({ grantUserVerificationFromMfa }))
vi.mock('@/components/security/mfa-challenge-dialog', () => ({
  MfaChallengeDialog: ({ open, onVerified }: { open: boolean; onVerified: () => void }) =>
    open ? (
      <button type="button" onClick={onVerified}>
        Verificar código MFA
      </button>
    ) : null,
}))

import { SendAeatButton } from './send-aeat-button'

describe('SendAeatButton', () => {
  const options = { challenge: 'challenge' }

  beforeEach(() => {
    vi.clearAllMocks()
    preparePasskeyAuthentication.mockResolvedValue({ ok: true, verified: false, options })
    completePasskeyAuthentication.mockResolvedValue({ ok: true })
    grantUserVerificationFromMfa.mockResolvedValue({ ok: true })
    sendToAeat.mockResolvedValue({ ok: true, status: 'accepted', csv: 'CSV-123' })
  })

  it('prepares the challenge before a distinct click starts device authentication', async () => {
    render(<SendAeatButton invoiceId="invoice-1" label="Reintentar envío" />)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar envío' }))

    await waitFor(() =>
      expect(preparePasskeyAuthentication).toHaveBeenCalledWith({
        intent: 'invoice.send_aeat',
        resource: 'invoice:invoice-1',
      }),
    )
    expect(completePasskeyAuthentication).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar con biometría' }))

    await waitFor(() =>
      expect(completePasskeyAuthentication).toHaveBeenCalledWith(
        { intent: 'invoice.send_aeat', resource: 'invoice:invoice-1' },
        options,
      ),
    )
    await waitFor(() => expect(sendToAeat).toHaveBeenCalledOnce())
    const [formData] = sendToAeat.mock.calls[0] as [FormData]
    expect(formData.get('id')).toBe('invoice-1')
  })

  it('does not report a passkey failure as a VERI*FACTU delivery error', async () => {
    completePasskeyAuthentication.mockResolvedValue({
      ok: false,
      error: 'Esta passkey no corresponde a este sitio.',
    })
    render(<SendAeatButton invoiceId="invoice-1" label="Reintentar envío" />)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar envío' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar con biometría' }))

    await waitFor(() => expect(completePasskeyAuthentication).toHaveBeenCalledOnce())
    expect(screen.queryByText('Error técnico de VERI*FACTU')).toBeNull()
    expect(screen.getByRole('button', { name: 'Usar código de autenticación' })).toBeDefined()
    expect(sendToAeat).not.toHaveBeenCalled()
  })

  it('allows a verified Google Authenticator code to authorize the same invoice-scoped send', async () => {
    render(<SendAeatButton invoiceId="invoice-1" label="Reintentar envío" />)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar envío' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Elegir otro método' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Usar código de autenticación' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar código MFA' }))

    await waitFor(() =>
      expect(grantUserVerificationFromMfa).toHaveBeenCalledWith({
        intent: 'invoice.send_aeat',
        resource: 'invoice:invoice-1',
      }),
    )
    await waitFor(() => expect(sendToAeat).toHaveBeenCalledOnce())
  })

  it('keeps the fiscal confirmation but skips biometrics during a recent session', async () => {
    preparePasskeyAuthentication.mockResolvedValue({ ok: true, verified: true })
    render(<SendAeatButton invoiceId="invoice-1" label="Reintentar envío" />)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar envío' }))

    expect(await screen.findByText(/Tu identidad ya está verificada/)).toBeDefined()
    expect(sendToAeat).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envío' }))
    await waitFor(() => expect(sendToAeat).toHaveBeenCalledOnce())
    expect(completePasskeyAuthentication).not.toHaveBeenCalled()
  })
})
