import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => {
  let value: string | undefined
  const store = {
    get: vi.fn(() => (value ? { value } : undefined)),
    set: vi.fn((_: string, next: string) => {
      value = next
    }),
    delete: vi.fn(() => {
      value = undefined
    }),
  }
  return { state: { store, clear: () => (value = undefined) } }
})

vi.mock('next/headers', () => ({ cookies: async () => state.store }))
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: 'test-key' }) }))

import {
  consumeUserVerification,
  grantUserVerification,
  hasRecentUserVerification,
} from './user-verification'
import { userVerificationScope } from './user-verification-scope'

describe('recent user verification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'))
    state.clear()
    state.store.get.mockClear()
    state.store.set.mockClear()
    state.store.delete.mockClear()
  })

  afterEach(() => vi.useRealTimers())

  it('reuses a verified session across sensitive actions for 15 minutes', async () => {
    const scope = userVerificationScope('invoice.send_aeat', 'invoice:invoice-a')
    await grantUserVerification('user-a', scope)

    await expect(consumeUserVerification('user-a', scope)).resolves.toBeUndefined()
    await expect(
      consumeUserVerification(
        'user-a',
        userVerificationScope('backup.delete', 'backup:client-a:file.sql'),
      ),
    ).resolves.toBeUndefined()
    await expect(hasRecentUserVerification('user-a')).resolves.toBe(true)
    expect(state.store.delete).not.toHaveBeenCalled()
    expect(state.store.set).toHaveBeenCalledWith(
      'recent_user_verification',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, maxAge: 15 * 60, sameSite: 'strict' }),
    )
  })

  it('does not authorize a different user', async () => {
    await grantUserVerification(
      'user-a',
      userVerificationScope('invoice.send_aeat', 'invoice:invoice-a'),
    )

    await expect(
      consumeUserVerification(
        'user-b',
        userVerificationScope('invoice.send_aeat', 'invoice:invoice-a'),
      ),
    ).rejects.toThrow('Confirma tu identidad')
    await expect(hasRecentUserVerification('user-b')).resolves.toBe(false)
  })

  it('expires the session after 15 minutes', async () => {
    const scope = userVerificationScope('vault.unlock', 'vault')
    await grantUserVerification('user-a', scope)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)

    await expect(consumeUserVerification('user-a', scope)).rejects.toThrow('Confirma tu identidad')
    await expect(hasRecentUserVerification('user-a')).resolves.toBe(false)
  })
})
