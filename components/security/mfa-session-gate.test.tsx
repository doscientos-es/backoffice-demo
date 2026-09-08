import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mfa, navigation } = vi.hoisted(() => ({
  mfa: { getAuthenticatorAssuranceLevel: vi.fn() },
  navigation: { pathname: '/settings/diagnostics', refresh: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ refresh: navigation.refresh }),
}))

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({ auth: { mfa } }),
}))

vi.mock('./mfa-challenge-dialog', () => ({
  MfaChallengeDialog: ({ open, onVerified }: { open: boolean; onVerified: () => void }) => (
    <button data-testid="mfa-dialog" data-open={open} type="button" onClick={onVerified}>
      Verificar
    </button>
  ),
}))

import { MfaSessionGate } from './mfa-session-gate'

describe('MfaSessionGate', () => {
  beforeEach(() => {
    navigation.pathname = '/settings/diagnostics'
    navigation.refresh.mockReset()
    mfa.getAuthenticatorAssuranceLevel.mockReset().mockResolvedValue({
      data: { currentLevel: 'aal1' },
      error: null,
    })
  })

  it('keeps an administrator on the requested route and opens the MFA dialog', async () => {
    render(<MfaSessionGate memberRole="admin" mfaVerified={false} />)

    expect(screen.getByTestId('mfa-dialog').dataset.open).toBe('true')
    await waitFor(() => expect(mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalledOnce())
  })

  it('does not challenge the security settings route', async () => {
    navigation.pathname = '/settings/security'
    render(<MfaSessionGate memberRole="admin" mfaVerified={false} />)

    expect(screen.getByTestId('mfa-dialog').dataset.open).toBe('false')
    await waitFor(() => expect(mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled())
  })

  it('refreshes the current route after the modal verifies MFA', async () => {
    render(<MfaSessionGate memberRole="owner" mfaVerified={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    expect(navigation.refresh).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByTestId('mfa-dialog').dataset.open).toBe('false'))
  })
})
