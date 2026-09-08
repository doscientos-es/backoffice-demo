import { describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }))
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: 'test-key' }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resolveWebAuthnConfig } from './webauthn'

describe('resolveWebAuthnConfig', () => {
  it('pins the canonical production relying party instead of an environment URL', () => {
    expect(
      resolveWebAuthnConfig({ origin: 'https://app.doscientos.es', host: null, protocol: null }),
    ).toEqual({
      expectedOrigin: 'https://app.doscientos.es',
      rpID: 'app.doscientos.es',
      rpName: 'Doscientos',
    })
  })

  it('uses a distinct localhost relying party for local development', () => {
    expect(resolveWebAuthnConfig({ origin: null, host: 'localhost:3000', protocol: null })).toEqual(
      {
        expectedOrigin: 'http://localhost:3000',
        rpID: 'localhost',
        rpName: 'Doscientos (local)',
      },
    )
  })

  it('rejects ephemeral Vercel hosts rather than binding a production passkey to them', () => {
    expect(() =>
      resolveWebAuthnConfig({
        origin: 'https://backoffice-git-feature-team.vercel.app',
        host: null,
        protocol: null,
      }),
    ).toThrow('dominio seguro configurado')
  })
})
