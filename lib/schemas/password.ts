import { z } from 'zod'

/**
 * Single source of truth for the password policy enforced across the app:
 * vault master password and user account passwords (Supabase Auth).
 *
 * Policy: at least 8 characters including lowercase, uppercase, a digit and a
 * symbol. Keep this aligned with any Supabase Auth password settings.
 */

export const PASSWORD_MIN_LENGTH = 8

/** Requires lowercase, uppercase, a digit and a non-alphanumeric symbol. */
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9])/

export const PASSWORD_MIN_LENGTH_MESSAGE = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`
export const PASSWORD_COMPLEXITY_MESSAGE = 'Debe incluir minúsculas, mayúsculas, números y símbolos'

/** Zod field for a password that must satisfy the full complexity policy. */
export const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE)
  .regex(PASSWORD_COMPLEXITY_REGEX, PASSWORD_COMPLEXITY_MESSAGE)

/**
 * Client-side validation helper mirroring `passwordField`. Returns an error
 * message when the password is invalid, or `null` when it satisfies the policy.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `${PASSWORD_MIN_LENGTH_MESSAGE}.`
  if (!PASSWORD_COMPLEXITY_REGEX.test(password)) return `${PASSWORD_COMPLEXITY_MESSAGE}.`
  return null
}
