import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    exchangedCode: null as string | null,
    exchangeError: null as { message: string } | null,
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => {
        state.exchangedCode = code
        return state.exchangeError
          ? { data: null, error: state.exchangeError }
          : { data: {}, error: null }
      },
    },
  }),
}))

vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { NextRequest } from 'next/server'

import { GET } from '@/app/auth/callback/route'

function call(path: string) {
  return GET(new NextRequest(`http://localhost${path}`))
}

describe('/auth/callback', () => {
  beforeEach(() => {
    state.exchangedCode = null
    state.exchangeError = null
  })

  it('exchanges the code without signing out first (preserves PKCE verifier cookie)', async () => {
    await call('/auth/callback?code=abc&next=/inicio')
    expect(state.exchangedCode).toBe('abc')
  })

  it('redirects to the validated next path on success', async () => {
    const res = await call('/auth/callback?code=abc&next=/login/update-password')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login/update-password')
  })

  it('defaults next to /inicio when missing', async () => {
    const res = await call('/auth/callback?code=abc')
    expect(res.headers.get('location')).toBe('http://localhost/inicio')
  })

  it('rejects absolute external next values and falls back to /inicio', async () => {
    const res = await call('/auth/callback?code=abc&next=https://evil.com/steal')
    expect(res.headers.get('location')).toBe('http://localhost/inicio')
  })

  it('rejects protocol-relative next values (//evil.com) and falls back to /inicio', async () => {
    const res = await call('/auth/callback?code=abc&next=//evil.com/phishing')
    expect(res.headers.get('location')).toBe('http://localhost/inicio')
  })

  it('redirects to /login with error when code is missing', async () => {
    const res = await call('/auth/callback')
    expect(res.headers.get('location')).toBe('http://localhost/login?error=callback_no_code')
    expect(state.exchangedCode).toBeNull()
  })

  it('surfaces provider error params without calling the exchange', async () => {
    const res = await call('/auth/callback?error=access_denied&error_description=link%20expired')
    expect(res.headers.get('location')).toContain('/login?error=callback_link%20expired')
    expect(state.exchangedCode).toBeNull()
  })

  it('redirects to /login when exchangeCodeForSession fails', async () => {
    state.exchangeError = { message: 'invalid pkce verifier' }
    const res = await call('/auth/callback?code=bad')
    expect(res.headers.get('location')).toBe(
      'http://localhost/login?error=callback_exchange_failed',
    )
    expect(state.exchangedCode).toBe('bad')
  })
})
