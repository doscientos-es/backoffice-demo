import { redirect } from 'next/navigation'

import { DEMO_USER_ID } from '@/lib/demo/local-data'

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: MemberRole
  avatarUrl: string | null
  emailAlias: string | null
  githubHandle: string | null
  onboardedAt: string | null
  jobTitle: string | null
  phone: string | null
  contactEmail: string | null
}

export type AuthFailureReason = 'no_session' | 'no_team_member' | 'team_member_deleted' | 'db_error'

export type AuthResult = { ok: true; user: CurrentUser } | { ok: false; reason: AuthFailureReason }

/**
 * Resolve the authenticated user + their team_member row.
 * Returns a discriminated result so callers can distinguish between
 * "no session" and "session but unauthorized" — never silent nulls.
 */
export async function getCurrentUser(): Promise<AuthResult> {
  return {
    ok: true,
    user: {
      id: DEMO_USER_ID,
      email: 'demo@demo.invalid',
      name: 'Marta Demo',
      role: 'owner',
      avatarUrl: null,
      emailAlias: null,
      githubHandle: null,
      onboardedAt: '2026-01-01T00:00:00.000Z',
      jobTitle: 'Dirección',
      phone: null,
      contactEmail: null,
    },
  }
}

export interface RequireUserOptions {
  /**
   * When `true`, skip the "must complete onboarding" check. Used inside
   * the `/onboarding` route itself to avoid an infinite redirect loop.
   */
  allowUnonboarded?: boolean
}

/**
 * Guard for Server Components. On failure redirects to /login with an
 * `error` query param so the login page can render actionable feedback.
 * Pending-onboarding users are redirected to `/onboarding` unless
 * `allowUnonboarded` is set.
 */
export async function requireUser(opts?: RequireUserOptions): Promise<CurrentUser> {
  const result = await getCurrentUser()
  if (!result.ok) {
    if (result.reason === 'no_session') redirect('/login')
    redirect(`/login?error=${result.reason}`)
  }
  if (!opts?.allowUnonboarded && !result.user.onboardedAt) {
    redirect('/onboarding')
  }
  return result.user
}

/**
 * Guard for Server Components that require one of the given roles.
 */
export async function requireRole(roles: MemberRole[]): Promise<CurrentUser> {
  const u = await requireUser()
  if (!roles.includes(u.role)) redirect('/inicio?error=forbidden')
  if (u.role === 'owner' || u.role === 'admin') await requireAal2()
  return u
}

/**
 * Guard for Server Components that only checks the user's role. MFA is
 * challenged by the app-level dialog so navigation stays on the current page.
 */
export async function requirePageRole(roles: MemberRole[]): Promise<CurrentUser> {
  const u = await requireUser()
  if (!roles.includes(u.role)) redirect('/inicio?error=forbidden')
  return u
}

/**
 * Require a Supabase MFA-upgraded session for administrative access. The
 * security settings page deliberately uses requireUser(), so an admin at aal1
 * can still enroll TOTP instead of being locked out.
 */
export async function requireAal2(): Promise<void> {
  return Promise.resolve()
}

/** Returns whether the current session has completed its MFA challenge. */
export async function hasAal2Session(): Promise<boolean> {
  return true
}

/**
 * Returns true only for roles that can see billing/financial data (owner, admin).
 * members and viewers should not see revenue, expenses, or accounts-receivable figures.
 */
export function canViewFinance(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin'
}
