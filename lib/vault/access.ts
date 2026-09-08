import 'server-only'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

import { cookies } from 'next/headers'

import { DEMO_SIGNING_KEY } from '@/lib/demo/config'

/**
 * Master-password gate for the vault.
 *
 * Passwords are hashed with scrypt (same format as portal passwords).
 * On successful unlock we drop an httpOnly cookie whose value is an HMAC
 * of a fixed vault token + the current hash, so the grant is invalidated
 * automatically when the password changes.
 */

const SCRYPT_KEYLEN = 64
const VAULT_COOKIE = 'vault_unlock'
const VAULT_TOKEN = 'vault-master' // fixed label for the HMAC
const COOKIE_MAX_AGE = 60 * 60 * 4 // 4 hours

/** Hashes a plaintext vault master password. */
export function hashVaultPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `scrypt$${salt}$${derived}`
}

/** Constant-time verification of password against a stored scrypt hash. */
export function verifyVaultPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, derivedHex] = parts
  if (!salt || !derivedHex) return false
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  const expected = Buffer.from(derivedHex, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}

function vaultFingerprint(hash: string): string {
  return createHmac('sha256', DEMO_SIGNING_KEY).update(`${VAULT_TOKEN}:${hash}`).digest('hex')
}

/** Sets the unlock cookie after a successful password check. */
export async function grantVaultUnlock(passwordHash: string): Promise<void> {
  const store = await cookies()
  store.set(VAULT_COOKIE, vaultFingerprint(passwordHash), {
    httpOnly: true,
    // A Secure cookie cannot be persisted over local HTTP, so it would make
    // the next server action appear locked immediately after unlocking.
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

/** Clears the unlock cookie (lock). */
export async function revokeVaultUnlock(): Promise<void> {
  const store = await cookies()
  store.delete(VAULT_COOKIE)
}

/**
 * Returns true when the vault is effectively unlocked:
 * - No password set → always unlocked.
 * - Password set + valid cookie → unlocked.
 */
export async function isVaultUnlocked(passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) return true
  const store = await cookies()
  const cookie = store.get(VAULT_COOKIE)
  if (!cookie) return false
  const a = Buffer.from(cookie.value)
  const b = Buffer.from(vaultFingerprint(passwordHash))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
