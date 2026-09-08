import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'

import { DEMO_SIGNING_KEY } from '@/lib/demo/config'

import type { UserVerificationScope } from './user-verification-scope'

/**
 * A successful step-up creates a short recent-verification session. Scopes still
 * bind each WebAuthn challenge to its initiating action, while the resulting
 * session can authorize sensitive work for a limited period.
 */
const VERIFICATION_COOKIE = 'recent_user_verification'
const VERIFICATION_MAX_AGE_SECONDS = 15 * 60

type VerificationGrant = {
  userId: string
  expiresAt: number
}

function sign(value: string): string {
  return createHmac('sha256', DEMO_SIGNING_KEY)
    .update(`user-verification:${value}`)
    .digest('base64url')
}

function encode(grant: VerificationGrant): string {
  const value = Buffer.from(JSON.stringify(grant)).toString('base64url')
  return `${value}.${sign(value)}`
}

function decode(cookieValue: string | undefined): VerificationGrant | null {
  if (!cookieValue) return null
  const [value, signature] = cookieValue.split('.')
  if (!value || !signature) return null

  const expected = Buffer.from(sign(value))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

  try {
    const grant = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as VerificationGrant
    if (!grant.userId || !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt <= Date.now()) {
      return null
    }
    return grant
  } catch {
    return null
  }
}

/** Issue a short-lived, HTTP-only authorization after verified WebAuthn. */
export async function grantUserVerification(
  userId: string,
  _scope: UserVerificationScope,
): Promise<void> {
  const store = await cookies()
  const grant: VerificationGrant = {
    userId,
    expiresAt: Date.now() + VERIFICATION_MAX_AGE_SECONDS * 1000,
  }
  store.set(VERIFICATION_COOKIE, encode(grant), {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
    maxAge: VERIFICATION_MAX_AGE_SECONDS,
  })
}

/** Returns whether this user still has a valid recent-verification session. */
export async function hasRecentUserVerification(userId: string): Promise<boolean> {
  const store = await cookies()
  const grant = decode(store.get(VERIFICATION_COOKIE)?.value)
  return grant?.userId === userId
}

/** Requires a recent verification without consuming the 15-minute session. */
export async function consumeUserVerification(
  userId: string,
  _scope: UserVerificationScope,
): Promise<void> {
  const store = await cookies()
  const grant = decode(store.get(VERIFICATION_COOKIE)?.value)

  if (!grant || grant.userId !== userId) {
    throw new Error('Confirma tu identidad con biometría o el bloqueo del dispositivo')
  }
}
