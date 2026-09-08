import { describe, expect, it } from 'vitest'

import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_LENGTH_MESSAGE,
  passwordField,
  validatePassword,
} from '@/lib/schemas/password'

// ─── constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('PASSWORD_MIN_LENGTH is 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })

  it('PASSWORD_COMPLEXITY_REGEX requires all four character classes', () => {
    expect(PASSWORD_COMPLEXITY_REGEX.test('Abc1!abc')).toBe(true)
    expect(PASSWORD_COMPLEXITY_REGEX.test('abcdefg1!')).toBe(false) // no uppercase
    expect(PASSWORD_COMPLEXITY_REGEX.test('ABCDEFG1!')).toBe(false) // no lowercase
    expect(PASSWORD_COMPLEXITY_REGEX.test('Abcdefg!!')).toBe(false) // no digit
    expect(PASSWORD_COMPLEXITY_REGEX.test('Abcdefg1')).toBe(false) // no symbol
  })
})

// ─── validatePassword ────────────────────────────────────────────────────────

describe('validatePassword', () => {
  it('returns null for a fully compliant password', () => {
    expect(validatePassword('Secure1!')).toBeNull()
    expect(validatePassword('MyP@ssw0rd!')).toBeNull()
    expect(validatePassword('Aa1!aaaa')).toBeNull()
  })

  it('returns length message when password is too short', () => {
    const msg = validatePassword('Ab1!')
    expect(msg).toContain(PASSWORD_MIN_LENGTH_MESSAGE)
  })

  it('returns complexity message when no uppercase', () => {
    expect(validatePassword('secure1!abc')).toContain(PASSWORD_COMPLEXITY_MESSAGE)
  })

  it('returns complexity message when no lowercase', () => {
    expect(validatePassword('SECURE1!ABC')).toContain(PASSWORD_COMPLEXITY_MESSAGE)
  })

  it('returns complexity message when no digit', () => {
    expect(validatePassword('Secure!!abc')).toContain(PASSWORD_COMPLEXITY_MESSAGE)
  })

  it('returns complexity message when no symbol', () => {
    expect(validatePassword('Secure1abcd')).toContain(PASSWORD_COMPLEXITY_MESSAGE)
  })

  it('returns length message (not complexity) for empty string', () => {
    const msg = validatePassword('')
    expect(msg).toContain(PASSWORD_MIN_LENGTH_MESSAGE)
    expect(msg).not.toContain(PASSWORD_COMPLEXITY_MESSAGE)
  })
})

// ─── passwordField (Zod) ─────────────────────────────────────────────────────

describe('passwordField', () => {
  it('passes a valid password', () => {
    expect(passwordField.safeParse('Secure1!').success).toBe(true)
  })

  it('rejects a password that is too short', () => {
    const result = passwordField.safeParse('Ab1!')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(PASSWORD_MIN_LENGTH_MESSAGE)
    }
  })

  it('rejects a password missing a symbol', () => {
    const result = passwordField.safeParse('Secure1abcd')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(PASSWORD_COMPLEXITY_MESSAGE)
    }
  })

  it('rejects a password missing an uppercase letter', () => {
    const result = passwordField.safeParse('secure1!abcd')
    expect(result.success).toBe(false)
  })

  it('rejects a password missing a lowercase letter', () => {
    const result = passwordField.safeParse('SECURE1!ABCD')
    expect(result.success).toBe(false)
  })

  it('rejects a password missing a digit', () => {
    const result = passwordField.safeParse('Secure!!abcd')
    expect(result.success).toBe(false)
  })
})
