import { beforeEach, describe, expect, it, vi } from 'vitest'

const { finishPasskeyAuthentication, startAuthentication } = vi.hoisted(() => ({
  finishPasskeyAuthentication: vi.fn(),
  startAuthentication: vi.fn(),
}))

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication,
  startRegistration: vi.fn(),
}))
vi.mock('./webauthn-actions', () => ({
  beginPasskeyAuthentication: vi.fn(),
  finishPasskeyAuthentication,
  finishPasskeyRegistration: vi.fn(),
}))

import { completePasskeyAuthentication } from './webauthn-client'

describe('completePasskeyAuthentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('explains when SimpleWebAuthn wraps an invalid relying-party error', async () => {
    const cause = Object.assign(new Error('RP ID is invalid'), { name: 'SecurityError' })
    startAuthentication.mockRejectedValue(
      Object.assign(new Error('The RP ID is invalid for this domain'), {
        cause,
        code: 'ERROR_INVALID_RP_ID',
      }),
    )

    await expect(
      completePasskeyAuthentication(
        { intent: 'invoice.send_aeat', resource: 'invoice:invoice-1' },
        { challenge: 'challenge' },
      ),
    ).resolves.toEqual({
      ok: false,
      error:
        'Esta passkey no corresponde a este sitio. Entra en Bóveda, desbloquéala con tu contraseña maestra y pulsa «Añadir passkey».',
    })
    expect(finishPasskeyAuthentication).not.toHaveBeenCalled()
  })

  it('keeps a cancelled browser ceremony distinct from an unknown failure', async () => {
    startAuthentication.mockRejectedValue(
      Object.assign(new Error('The operation was cancelled'), { name: 'NotAllowedError' }),
    )

    await expect(
      completePasskeyAuthentication(
        { intent: 'invoice.send_aeat', resource: 'invoice:invoice-1' },
        { challenge: 'challenge' },
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'La verificación se ha cancelado, ha caducado o no hay una passkey disponible',
    })
  })
})
