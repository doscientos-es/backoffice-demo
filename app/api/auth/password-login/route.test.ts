import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    rateLimit: vi.fn(),
    signIn: vi.fn(),
  },
}))

vi.mock('@/lib/env', () => ({
  publicEnv: { NEXT_PUBLIC_HCAPTCHA_SITE_KEY: 'test-site-key' },
  serverEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-aaaaaaaaaaaaaaaa' }),
}))
vi.mock('@/lib/ratelimit', () => ({ distributedRateLimit: state.rateLimit }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ auth: { signInWithPassword: state.signIn } }),
}))

import { POST } from './route'

function request(body: unknown, ip = '203.0.113.1') {
  return new NextRequest('http://localhost/api/auth/password-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/password-login', () => {
  beforeEach(() => {
    state.rateLimit.mockReset().mockResolvedValue({ success: true })
    state.signIn.mockReset().mockResolvedValue({ error: null })
  })

  it('starts a password session when all limits allow the request', async () => {
    const response = await POST(
      request({ email: 'member@example.test', password: 'correct horse' }),
    )

    expect(response.status).toBe(200)
    expect(state.signIn).toHaveBeenCalledWith({
      email: 'member@example.test',
      password: 'correct horse',
      options: { captchaToken: undefined },
    })
  })

  it('blocks an exhausted IP before attempting authentication', async () => {
    state.rateLimit.mockResolvedValueOnce({ success: false })
    const response = await POST(request({ email: 'member@example.test', password: 'password' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({ error: 'rate_limited' })
    expect(state.signIn).not.toHaveBeenCalled()
  })

  it('requires CAPTCHA after the account attempt threshold is exhausted', async () => {
    state.rateLimit
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false })
    const response = await POST(request({ email: 'member@example.test', password: 'password' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'captcha_required',
      captchaRequired: true,
    })
    expect(state.signIn).not.toHaveBeenCalled()
  })

  it('does not disclose whether invalid credentials belong to a real account', async () => {
    state.signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const response = await POST(request({ email: 'member@example.test', password: 'wrong' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_credentials',
      captchaRequired: false,
    })
  })
})
