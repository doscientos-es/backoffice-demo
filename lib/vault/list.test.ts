import { describe, expect, it } from 'vitest'

import { filterAndSortVaultItems, type VaultListItem } from './list'

const items: VaultListItem[] = [
  {
    id: '1',
    name: 'Hosting',
    service: 'hosting',
    username: 'a',
    notes: null,
    is_sensitive: true,
    expires_at: null,
    client_id: 'client-1',
    created_at: '2026-01-01',
  },
  {
    id: '2',
    name: 'API',
    service: 'api',
    username: null,
    notes: 'token',
    is_sensitive: false,
    expires_at: '2026-09-01',
    client_id: null,
    created_at: '2026-01-01',
  },
]

describe('vault list projection', () => {
  it('filters without exposing or depending on encrypted secrets', () => {
    const result = filterAndSortVaultItems(items, {
      search: 'token',
      service: '',
      sensitivity: 'public',
      clientId: '',
      sortField: 'name',
      sortDirection: 'asc',
    })
    expect(result.map((item) => item.id)).toEqual(['2'])
  })

  it('keeps undated credentials after dated ones in ascending expiry order', () => {
    const result = filterAndSortVaultItems(items, {
      search: '',
      service: '',
      sensitivity: '',
      clientId: '',
      sortField: 'expires_at',
      sortDirection: 'asc',
    })
    expect(result.map((item) => item.id)).toEqual(['2', '1'])
  })
})
