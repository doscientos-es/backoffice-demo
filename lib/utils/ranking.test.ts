import { describe, expect, it } from 'vitest'

import { rankAfter, rankBefore, rankBetween } from '@/lib/utils/ranking'

describe('rankBetween', () => {
  it('returns a key strictly between two adjacent-gap keys', () => {
    const mid = rankBetween('a', 'c')
    expect(mid > 'a').toBe(true)
    expect(mid < 'c').toBe(true)
    expect(mid).toBe('b')
  })

  it('appends when both bounds are open-ended', () => {
    // midpoint("", "") → 'a' .. 'z' gap > 1 → middle char
    const k = rankBetween(null, null)
    expect(k.length).toBeGreaterThan(0)
    expect(rankBetween(null, '')).toBe(k)
  })

  it('recurses into the tail when characters are adjacent', () => {
    const k = rankBetween('a', 'b')
    expect(k > 'a').toBe(true)
    expect(k < 'b').toBe(true)
    // 'a' then recurse on "" → produces "a" + middle of (a..z)
    expect(k.startsWith('a')).toBe(true)
  })

  it("produces a key before 'a' boundary by going open-left", () => {
    const k = rankBefore('b')
    expect(k < 'b').toBe(true)
    expect(k).toBe('a')
  })

  it('produces a key after the last when open-right', () => {
    const k = rankAfter('y')
    expect(k > 'y').toBe(true)
  })

  it('rankAfter(null) seeds the very first key', () => {
    const first = rankAfter(null)
    expect(first.length).toBeGreaterThan(0)
    expect(first >= 'a' && first <= 'z').toBe(true)
  })

  it('throws when a >= b', () => {
    expect(() => rankBetween('c', 'a')).toThrow(/requires a < b/)
    expect(() => rankBetween('b', 'b')).toThrow(/requires a < b/)
  })

  it('throws on invalid (non a-z) keys', () => {
    expect(() => rankBetween('A', null)).toThrow(/Invalid rank key/)
    expect(() => rankBetween('a1', null)).toThrow(/Invalid rank key/)
    expect(() => rankBetween(null, 'Z')).toThrow(/Invalid rank key/)
  })
})

describe('rankBetween ordering invariants', () => {
  it('keeps lexicographic order across many sequential inserts at the end', () => {
    let last: string | null = null
    const keys: string[] = []
    for (let i = 0; i < 50; i++) {
      last = rankAfter(last)
      keys.push(last)
    }
    const sorted = [...keys].sort()
    expect(keys).toEqual(sorted)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps order when repeatedly inserting between two fixed keys', () => {
    let lo = 'a'
    const hi = 'z'
    const inserted: string[] = []
    for (let i = 0; i < 30; i++) {
      const mid = rankBetween(lo, hi)
      expect(mid > lo).toBe(true)
      expect(mid < hi).toBe(true)
      inserted.push(mid)
      lo = mid
    }
    expect(inserted).toEqual([...inserted].sort())
  })

  it('can always split the gap between two freshly generated neighbours', () => {
    const a = rankAfter(null)
    const b = rankAfter(a)
    const between = rankBetween(a, b)
    expect(between > a).toBe(true)
    expect(between < b).toBe(true)
  })
})
