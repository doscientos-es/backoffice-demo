import { describe, expect, it } from 'vitest'

import {
  cn,
  formatDate,
  formatDateTime,
  formatEUR,
  memberAvatarUrl,
  pluralize,
  relativeTime,
  truncate,
} from '@/lib/utils'

describe('cn', () => {
  it('merges Tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('formatEUR', () => {
  it('formats a number with EUR', () => {
    const out = formatEUR(1234.5)
    expect(out).toMatch(/1.?234,50/)
    expect(out).toMatch(/€/)
  })
  it('parses numeric strings', () => {
    expect(formatEUR('10')).toMatch(/10,00/)
  })
  it('returns em-dash on null, undefined and non-finite', () => {
    expect(formatEUR(null)).toBe('—')
    expect(formatEUR(undefined)).toBe('—')
    expect(formatEUR(Number.POSITIVE_INFINITY)).toBe('—')
    expect(formatEUR('abc')).toBe('—')
  })
})

describe('pluralize', () => {
  it('returns the singular form only for one item', () => {
    expect(pluralize(1, 'tarea', 'tareas')).toBe('tarea')
    expect(pluralize(0, 'tarea', 'tareas')).toBe('tareas')
    expect(pluralize(2, 'tarea', 'tareas')).toBe('tareas')
  })
})

describe('formatDate / formatDateTime', () => {
  it('formats a date string', () => {
    expect(formatDate('2025-01-15')).toMatch(/2025/)
    expect(formatDate(new Date('2025-01-15'))).toMatch(/2025/)
  })
  it('formats a datetime', () => {
    expect(formatDateTime('2025-01-15T10:30:00Z')).toMatch(/2025/)
  })
  it('returns em-dash on empty input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })
  it('returns em-dash instead of throwing for malformed values', () => {
    expect(formatDate('not-a-date')).toBe('—')
    expect(formatDateTime('not-a-date')).toBe('—')
  })
})

describe('relativeTime', () => {
  it('returns em-dash on empty input', () => {
    expect(relativeTime(null)).toBe('—')
  })
  it('buckets recent and old past timestamps', () => {
    const now = Date.now()
    expect(relativeTime(new Date(now - 5_000))).toBeTypeOf('string')
    expect(relativeTime(new Date(now - 120_000))).toBeTypeOf('string')
    expect(relativeTime(new Date(now - 7_200_000))).toBeTypeOf('string')
    expect(relativeTime(new Date(now - 172_800_000))).toBeTypeOf('string')
    expect(relativeTime(new Date(now - 5_184_000_000))).toBeTypeOf('string')
    expect(relativeTime(new Date(now - 63_072_000_000))).toBeTypeOf('string')
  })
  it('future dates use the correct time unit, not seconds', () => {
    const now = Date.now()
    // 5 hours in the future — must NOT show seconds
    const fiveHours = relativeTime(new Date(now + 5 * 3_600_000))
    expect(fiveHours).not.toMatch(/segundo/)
    expect(fiveHours).toMatch(/hora/)
    // 3 days in the future
    const threeDays = relativeTime(new Date(now + 3 * 86_400_000))
    expect(threeDays).not.toMatch(/segundo/)
    // 2 months in the future
    expect(relativeTime(new Date(now + 60 * 86_400_000))).toBeTypeOf('string')
  })
})

describe('memberAvatarUrl', () => {
  it('prefers an explicit avatar url', () => {
    expect(memberAvatarUrl({ avatarUrl: 'https://x/a.png' })).toBe('https://x/a.png')
  })
  it('derives a github avatar from a valid handle', () => {
    expect(memberAvatarUrl({ githubHandle: 'octocat' }, 32)).toBe(
      'https://github.com/octocat.png?size=32',
    )
  })
  it('returns null for missing/invalid handles', () => {
    expect(memberAvatarUrl({})).toBeNull()
    expect(memberAvatarUrl({ githubHandle: '  ' })).toBeNull()
    expect(memberAvatarUrl({ githubHandle: '-bad' })).toBeNull()
  })
})

describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
  })
  it('keeps short strings intact', () => {
    expect(truncate('ab', 4)).toBe('ab')
  })
})
