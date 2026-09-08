import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { completePasskeyAuthentication, preparePasskeyAuthentication } = vi.hoisted(() => ({
  completePasskeyAuthentication: vi.fn(),
  preparePasskeyAuthentication: vi.fn(),
}))

vi.mock('@/lib/security/webauthn-client', () => ({
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
}))

import { usePasskeyVerification } from './use-passkey-verification'

function VerificationHarness() {
  const { challenge, verifyWithPasskey } = usePasskeyVerification()

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const result = await verifyWithPasskey({ intent: 'vault.unlock', resource: 'vault' })
          if (result.ok) document.body.dataset.verification = 'complete'
        }}
      >
        Iniciar
      </button>
      {challenge}
    </>
  )
}

describe('usePasskeyVerification', () => {
  const options = { challenge: 'challenge' }

  beforeEach(() => {
    vi.clearAllMocks()
    delete document.body.dataset.verification
    preparePasskeyAuthentication.mockResolvedValue({ ok: true, verified: false, options })
    completePasskeyAuthentication.mockResolvedValue({ ok: true })
  })

  it('waits for a distinct confirmation before starting device authentication', async () => {
    render(<VerificationHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }))

    await waitFor(() => expect(preparePasskeyAuthentication).toHaveBeenCalledOnce())
    expect(completePasskeyAuthentication).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar en este dispositivo' }))

    await waitFor(() =>
      expect(completePasskeyAuthentication).toHaveBeenCalledWith(
        { intent: 'vault.unlock', resource: 'vault' },
        options,
      ),
    )
    await waitFor(() => expect(document.body.dataset.verification).toBe('complete'))
  })

  it('continues without a dialog while the recent session is active', async () => {
    preparePasskeyAuthentication.mockResolvedValue({ ok: true, verified: true })
    render(<VerificationHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }))

    await waitFor(() => expect(document.body.dataset.verification).toBe('complete'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(completePasskeyAuthentication).not.toHaveBeenCalled()
  })
})
