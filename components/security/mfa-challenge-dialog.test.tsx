import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mfa } = vi.hoisted(() => ({
  mfa: {
    listFactors: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({ auth: { mfa } }),
}))

import { MfaChallengeDialog } from './mfa-challenge-dialog'

describe('MfaChallengeDialog', () => {
  beforeEach(() => {
    mfa.listFactors.mockReset().mockResolvedValue({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] },
      error: null,
    })
    mfa.challengeAndVerify.mockReset().mockResolvedValue({ error: null })
  })

  it('submits a normalized six-digit code from the shared OTP input', async () => {
    const onVerified = vi.fn()
    render(<MfaChallengeDialog open onOpenChange={vi.fn()} onVerified={onVerified} />)
    const input = await screen.findByRole('textbox', { name: /código de verificación/i })
    await waitFor(() => expect(input).toHaveProperty('disabled', false))

    fireEvent.change(input, { target: { value: '12a3 45-6' } })
    fireEvent.click(screen.getByRole('button', { name: /verificar y continuar/i }))

    await waitFor(() => {
      expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
        factorId: 'factor-1',
        code: '123456',
      })
      expect(onVerified).toHaveBeenCalledOnce()
    })
  })
})
