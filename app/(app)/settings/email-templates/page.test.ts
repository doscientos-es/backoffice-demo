import { describe, expect, it, vi } from 'vitest'

const { mockRedirect } = vi.hoisted(() => ({ mockRedirect: vi.fn() }))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

import EmailTemplatesPage from '@/app/(app)/settings/email-templates/page'

describe('email template settings legacy route', () => {
  it('redirects to the consolidated email settings page', () => {
    EmailTemplatesPage()
    expect(mockRedirect).toHaveBeenCalledWith('/settings/email')
  })
})
