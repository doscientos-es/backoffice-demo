import { describe, expect, it, vi } from 'vitest'

// ── hoist the spy so it is available inside the vi.mock factory ──────────────

const { mockRedirect } = vi.hoisted(() => ({ mockRedirect: vi.fn() }))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

// ── SUT ──────────────────────────────────────────────────────────────────────

import SettingsPage from '@/app/(app)/settings/page'

// ── tests ─────────────────────────────────────────────────────────────────────

describe('settings root page', () => {
  it('redirects to /settings/profile', () => {
    SettingsPage()
    expect(mockRedirect).toHaveBeenCalledWith('/settings/profile')
  })

  it('redirects exactly once per render', () => {
    mockRedirect.mockClear()
    SettingsPage()
    expect(mockRedirect).toHaveBeenCalledTimes(1)
  })
})
