import { describe, expect, it, vi } from 'vitest'

const { mockRedirect } = vi.hoisted(() => ({ mockRedirect: vi.fn() }))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import IntegrationsSettingsPage from '@/app/(app)/settings/integrations/page'

describe('integrations settings legacy route', () => {
  it('redirects to the consolidated email settings page', () => {
    IntegrationsSettingsPage()
    expect(mockRedirect).toHaveBeenCalledWith('/settings/email')
  })
})
