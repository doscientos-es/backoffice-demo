import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mfa } = vi.hoisted(() => ({
  mfa: {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
    getAuthenticatorAssuranceLevel: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({ auth: { mfa } }),
}))

import { MfaTotpCard } from './mfa-totp-card'

describe('MfaTotpCard', () => {
  beforeEach(() => {
    mfa.listFactors.mockReset().mockResolvedValue({ data: { totp: [] }, error: null })
    mfa.enroll.mockReset().mockResolvedValue({
      data: { id: 'factor-1', totp: { qr_code: 'data:image/svg+xml,test' } },
      error: null,
    })
    mfa.challengeAndVerify.mockReset().mockResolvedValue({ error: null })
    mfa.getAuthenticatorAssuranceLevel.mockReset().mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    })
  })

  it('explains that MFA is required for administrators and starts enrollment', async () => {
    render(<MfaTotpCard required />)

    expect(await screen.findByText(/obligatoria para administrar/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /configurar mfa/i }))

    await waitFor(() => expect(mfa.enroll).toHaveBeenCalledOnce())
    expect(screen.getByRole('img', { name: /código qr/i }).getAttribute('src')).toContain(
      'data:image/svg+xml,test',
    )
    const codeInput = screen.getByRole('textbox', { name: /código de verificación/i })
    expect(codeInput.getAttribute('autocomplete')).toBe('one-time-code')
    expect(document.querySelectorAll('[data-slot="otp-input-slot"]')).toHaveLength(6)
  })

  it('normalizes the enrollment code before verification', async () => {
    mfa.challengeAndVerify.mockResolvedValue({ error: new Error('invalid') })
    render(<MfaTotpCard required />)
    await screen.findByRole('button', { name: /configurar mfa/i })
    fireEvent.click(screen.getByRole('button', { name: /configurar mfa/i }))
    await screen.findByRole('img', { name: /código qr/i })

    fireEvent.change(screen.getByRole('textbox', { name: /código de verificación/i }), {
      target: { value: '12a3 45-6' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verificar y activar/i }))

    await waitFor(() =>
      expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
        factorId: 'factor-1',
        code: '123456',
      }),
    )
  })

  it('shows an active state for a verified TOTP factor', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      error: null,
    })
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2' },
      error: null,
    })
    render(<MfaTotpCard required={false} />)

    expect(await screen.findByText('Activa')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /configurar mfa/i })).toBeNull()
  })

  it('asks a verified administrator to upgrade an aal1 session', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      error: null,
    })
    render(<MfaTotpCard required />)

    expect(await screen.findByRole('button', { name: /verificar acceso/i })).toBeTruthy()
  })
})
