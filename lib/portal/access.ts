import 'server-only'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'

import { DEMO_SIGNING_KEY } from '@/lib/demo/config'
import { PortalUnlockInput, type UpdatePortalAccessInputType } from '@/lib/schemas/portal'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Password protection + unlock state for the public `/p/...` portal links.
 *
 * Passwords are hashed with scrypt (`scrypt$<salt>$<derived>`), never stored
 * in plaintext. Once a visitor enters the right password we drop an
 * `httpOnly` cookie whose value is an HMAC of the token + current hash, so the
 * grant is scoped to that exact resource and is invalidated automatically when
 * the password is changed or removed.
 *
 * Server-only: imports `node:crypto` and the service-role secret.
 */

const SCRYPT_KEYLEN = 64
const COOKIE_PREFIX = 'portal_unlock_'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/** Hashes a plaintext portal password into a self-describing scrypt string. */
export function hashPortalPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `scrypt$${salt}$${derived}`
}

/**
 * Translates an `UpdatePortalAccessInput` into a `proposals`/`invoices` column
 * patch. Only the fields the admin actually touched are present, so a single
 * helper drives both the visibility toggle and the optional password change.
 */
export function buildPortalAccessPatch(
  input: UpdatePortalAccessInputType,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (input.is_client_visible !== undefined) patch.is_client_visible = input.is_client_visible
  if (input.password !== undefined) {
    patch.portal_password_hash =
      input.password === null || input.password === '' ? null : hashPortalPassword(input.password)
  }
  return patch
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPortalPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, derivedHex] = parts
  if (!salt || !derivedHex) return false
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  const expected = Buffer.from(derivedHex, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}

/** HMAC binding an unlock grant to a specific token + password hash. */
function fingerprint(token: string, passwordHash: string): string {
  return createHmac('sha256', DEMO_SIGNING_KEY).update(`${token}:${passwordHash}`).digest('hex')
}

function portalCookieName(token: string): string {
  return `${COOKIE_PREFIX}${token}`
}

/** Sets the unlock cookie after a successful password check. */
export async function grantPortalUnlock(token: string, passwordHash: string): Promise<void> {
  const store = await cookies()
  store.set(portalCookieName(token), fingerprint(token, passwordHash), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

/**
 * Returns true when the visitor may see the resource: either there is no
 * password (`passwordHash` is null) or a valid unlock cookie is present.
 */
export async function isPortalUnlocked(
  token: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (!passwordHash) return true
  const store = await cookies()
  const cookie = store.get(portalCookieName(token))
  if (!cookie) return false
  const a = Buffer.from(cookie.value)
  const b = Buffer.from(fingerprint(token, passwordHash))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Verifies a visitor-supplied password against the stored hash for a portal
 * resource and, on success, drops the unlock cookie. Shared by the proposal
 * and invoice unlock forms — only the source table differs.
 *
 * Returns `ok` when the resource has no password (nothing to unlock) and
 * refuses resources the admin has hidden from the client.
 */
export async function unlockPortalResource(
  table: 'proposals' | 'invoices' | 'projects',
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = PortalUnlockInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const { token, password } = parsed.data

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from(table)
    .select('portal_password_hash, is_client_visible')
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !row) return { ok: false, error: 'Recurso no encontrado' }
  const access = row as unknown as {
    portal_password_hash: string | null
    is_client_visible: boolean | null
  }
  if (access.is_client_visible === false) return { ok: false, error: 'Recurso no disponible' }
  if (!access.portal_password_hash) return { ok: true }
  if (!verifyPortalPassword(password, access.portal_password_hash)) {
    return { ok: false, error: 'Contraseña incorrecta' }
  }

  await grantPortalUnlock(token, access.portal_password_hash)
  return { ok: true }
}
