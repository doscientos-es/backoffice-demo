import { type NextRequest, NextResponse } from 'next/server'

import { scopedLogger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

type EmailOtpType = 'invite' | 'recovery' | 'magiclink' | 'signup'

const log = scopedLogger('auth.confirm')

/**
 * OTP confirmation callback for Supabase Auth (SSR flow).
 *
 * Handles links whose token was minted server-side via
 * `admin.auth.admin.generateLink()` — currently team invitations. Those links
 * carry a `token_hash` (from `properties.hashed_token`) and a `type`, which we
 * exchange for a session with `verifyOtp`.
 *
 * Why this exists separately from /auth/callback:
 * The PKCE `?code=` flow used by /auth/callback requires a code-verifier cookie
 * that only exists when the browser itself initiated the auth request. Links
 * built from an admin-generated token have no such verifier, so Supabase's own
 * `/verify` endpoint falls back to the implicit flow and returns the tokens in
 * the URL hash (`#access_token=…`) — unreadable server-side. Using `verifyOtp`
 * with the `token_hash` avoids the implicit flow entirely and establishes the
 * session through the SSR cookie adapter.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const rawNext = url.searchParams.get('next')
  // Block protocol-relative URLs like //evil.com (startsWith("/") passes but
  // resolves to an external origin when fed to new URL()).
  const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/inicio'

  if (!tokenHash || !type) {
    log.warn({ hasToken: Boolean(tokenHash), type }, 'confirm missing token_hash or type')
    return NextResponse.redirect(new URL('/login?error=confirm_invalid_link', request.url))
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) {
    log.error({ err: error }, 'verifyOtp failed')
    return NextResponse.redirect(new URL('/login?error=confirm_failed', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
