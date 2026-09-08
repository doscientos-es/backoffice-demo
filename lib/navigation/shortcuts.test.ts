import { describe, expect, it } from 'vitest'

import {
  CREATE_SHORTCUTS,
  findShortcut,
  mergeRecentItems,
  NAV_SHORTCUTS,
  type RecentItem,
} from '@/lib/navigation/shortcuts'

describe('findShortcut', () => {
  it('matches by key case-insensitively', () => {
    expect(findShortcut(NAV_SHORTCUTS, 'l')?.href).toBe('/leads')
    expect(findShortcut(NAV_SHORTCUTS, 'L')?.href).toBe('/leads')
  })

  it('returns undefined for an unknown key', () => {
    expect(findShortcut(NAV_SHORTCUTS, 'z')).toBeUndefined()
  })

  it('resolves create shortcuts independently from nav ones', () => {
    expect(findShortcut(CREATE_SHORTCUTS, 'l')?.href).toBe('/leads/new')
  })
})

describe('shortcut tables are internally consistent', () => {
  it('has unique keys within each list', () => {
    for (const list of [NAV_SHORTCUTS, CREATE_SHORTCUTS]) {
      const keys = list.map((s) => s.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('uses lowercase single-character keys', () => {
    for (const s of [...NAV_SHORTCUTS, ...CREATE_SHORTCUTS]) {
      expect(s.key).toBe(s.key.toLowerCase())
      expect(s.key).toHaveLength(1)
    }
  })
})

describe('mergeRecentItems', () => {
  const a: RecentItem = { href: '/a', label: 'A' }
  const b: RecentItem = { href: '/b', label: 'B' }
  const c: RecentItem = { href: '/c', label: 'C' }

  it('prepends the new item', () => {
    expect(mergeRecentItems([b], a)).toEqual([a, b])
  })

  it('deduplicates by href, moving the item to the front', () => {
    const updatedA: RecentItem = { href: '/a', label: 'A2' }
    expect(mergeRecentItems([a, b], updatedA)).toEqual([updatedA, b])
  })

  it('caps the list at the max length (default 5)', () => {
    const list: RecentItem[] = Array.from({ length: 5 }, (_, i) => ({
      href: `/${i}`,
      label: `${i}`,
    }))
    const merged = mergeRecentItems(list, c)
    expect(merged).toHaveLength(5)
    expect(merged[0]).toEqual(c)
  })

  it('honours a custom max', () => {
    expect(mergeRecentItems([a, b], c, 2)).toEqual([c, a])
  })
})
