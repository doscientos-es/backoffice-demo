import { beforeEach, describe, expect, it, vi } from 'vitest'

import { rateLimit, resetRateLimit } from '@/lib/ratelimit'

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers()
    resetRateLimit('test-key')
  })

  it('allows requests under the limit', () => {
    const r1 = rateLimit('test-key', 3)
    const r2 = rateLimit('test-key', 3)
    const r3 = rateLimit('test-key', 3)

    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(2)
    expect(r2.success).toBe(true)
    expect(r2.remaining).toBe(1)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('blocks requests over the limit', () => {
    for (let i = 0; i < 3; i++) rateLimit('test-key', 3)
    const blocked = rateLimit('test-key', 3)

    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('isolates buckets per key', () => {
    for (let i = 0; i < 3; i++) rateLimit('key-a', 3)
    const fromB = rateLimit('key-b', 3)

    expect(fromB.success).toBe(true)
    expect(fromB.remaining).toBe(2)
  })

  it('resets after the window expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-25T12:00:00Z'))

    for (let i = 0; i < 3; i++) rateLimit('window-key', 3, 60_000)
    expect(rateLimit('window-key', 3, 60_000).success).toBe(false)

    vi.setSystemTime(new Date('2026-05-25T12:01:01Z'))
    const afterReset = rateLimit('window-key', 3, 60_000)
    expect(afterReset.success).toBe(true)
    expect(afterReset.remaining).toBe(2)
  })

  it('exposes the resetAt timestamp', () => {
    vi.useFakeTimers()
    const fixedNow = new Date('2026-05-25T12:00:00Z').getTime()
    vi.setSystemTime(fixedNow)

    const result = rateLimit('reset-key', 5, 60_000)
    expect(result.resetAt).toBe(fixedNow + 60_000)
  })
})
