export type VaultListItem = {
  id: string
  name: string
  service: string
  username: string | null
  notes: string | null
  is_sensitive: boolean
  expires_at: string | null
  client_id: string | null
  created_at: string
}

export type VaultSortField = 'name' | 'service' | 'expires_at'

export type VaultListFilters = {
  search: string
  service: string
  sensitivity: '' | 'sensitive' | 'public'
  clientId: string
  sortField: VaultSortField
  sortDirection: 'asc' | 'desc'
}

export function filterAndSortVaultItems(items: VaultListItem[], filters: VaultListFilters) {
  const search = filters.search.trim().toLowerCase()
  const filtered = items.filter((item) => {
    if (
      search &&
      ![item.name, item.username, item.notes, item.service].some((value) =>
        value?.toLowerCase().includes(search),
      )
    ) {
      return false
    }
    if (filters.service && item.service !== filters.service) return false
    if (filters.sensitivity === 'sensitive' && !item.is_sensitive) return false
    if (filters.sensitivity === 'public' && item.is_sensitive) return false
    return !filters.clientId || item.client_id === filters.clientId
  })

  return [...filtered].sort((a, b) => {
    if (filters.sortField === 'expires_at') {
      if (!a.expires_at && !b.expires_at) return 0
      if (!a.expires_at) return filters.sortDirection === 'asc' ? 1 : -1
      if (!b.expires_at) return filters.sortDirection === 'asc' ? -1 : 1
    }
    const comparison = String(a[filters.sortField] ?? '').localeCompare(
      String(b[filters.sortField] ?? ''),
    )
    return filters.sortDirection === 'asc' ? comparison : -comparison
  })
}
