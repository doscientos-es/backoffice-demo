import { type NextRequest, NextResponse } from 'next/server'

import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('auth.callback')

/**
 * PKCE callback for Supabase Auth.
 *
 * Handles every link Supabase sends out: invitations, password recovery,
 * email confirmations and magic links. The provider redirects here with
 * `?code=<auth_code>` (and optionally `?next=/some/path`).
 *
 * Why this route exists:
 * Without an explicit `exchangeCodeForSession` step the auth code in the URL
 * is never traded for a session. The form pages that follow (e.g. the
 * update-password page) then run against *whatever session was already in
 * the browser cookies*, which leads to a user accidentally changing the
 * password of a different account if cookies for that account happened to
 * be alive. To eliminate that class of bug we ALWAYS `signOut()` any
 * pre-existing session before exchanging the code, so the resulting
 * session is guaranteed to belong to the link's recipient.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  const rawNext = url.searchParams.get('next')
  // Block protocol-relative URLs like //evil.com (startsWith("/") passes but
  // resolves to an external origin when fed to new URL()).
  const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/inicio'

  if (errorParam) {
    log.warn({ errorParam }, 'callback received provider error')
    return NextResponse.redirect(
      new URL(`/login?error=callback_${encodeURIComponent(errorParam)}`, request.url),
    )
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=callback_no_code', request.url))
  }

  const supabase = await createServerClient()

  // exchangeCodeForSession always creates a fresh session for the recovery
  // link's recipient, overwriting any existing session in the cookies. We
  // must NOT call signOut() here first: signOut clears the PKCE code-verifier
// cookie that the former authentication adapter stored when the browser called
  // resetPasswordForEmail / inviteUserByEmail, so the exchange would fail
  // immediately with an "invalid code verifier" error and the user would land
  // on /login with a spurious "session expired" message.
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    log.error({ err: error }, 'exchangeCodeForSession failed')
    return NextResponse.redirect(new URL('/login?error=callback_exchange_failed', request.url))
  }

  // Sync Google avatar → team_members.avatar_url on every OAuth sign-in.
  // Uses the admin client to bypass the owner/admin-only UPDATE RLS policy.
  // We always overwrite so the avatar stays in sync if the user updates their
  // Google profile picture. Falls back to GitHub avatar via memberAvatarUrl()
  // when avatar_url is null.
  const user = data?.user
  if (user?.app_metadata?.provider === 'google') {
    const googleAvatar =
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      null
    if (googleAvatar) {
      const admin = createAdminClient()
      const { error: avatarError } = await admin
        .from('team_members')
        .update({ avatar_url: googleAvatar, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (avatarError) {
        log.warn({ err: avatarError, userId: user.id }, 'google avatar sync failed')
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
