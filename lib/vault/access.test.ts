import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}))

vi.mock('@/lib/env', () => ({
  serverEnv: vi.fn(() => ({ SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key' })),
}))

import { grantVaultUnlock } from './access'

describe('grantVaultUnlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows the unlock cookie over local HTTP outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    await grantVaultUnlock('scrypt$salt$hash')

    expect(cookieStore.set).toHaveBeenCalledWith(
      'vault_unlock',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: false }),
    )
  })

  it('keeps the unlock cookie secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await grantVaultUnlock('scrypt$salt$hash')

    expect(cookieStore.set).toHaveBeenCalledWith(
      'vault_unlock',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: true }),
    )
  })
})
