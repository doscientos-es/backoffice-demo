import { describe, expect, it } from 'vitest'

import {
  leadKanbanColumnIds,
  preferencesFromLegacyCompactColumns,
  resolveCompactLeadKanbanColumns,
  toggleLeadKanbanColumnPreference,
} from './kanban-preferences'

describe('lead kanban column preferences', () => {
  it('keeps configured closed columns compact despite legacy compact preferences', () => {
    const compact = resolveCompactLeadKanbanColumns({ compact: ['new'], expanded: [] })

    expect([...compact]).toEqual(['won', 'lost', 'not_interested', 'archived', 'new'])
  })

  it('allows explicitly expanded columns and ignores invalid stored ids', () => {
    const compact = resolveCompactLeadKanbanColumns({
      compact: leadKanbanColumnIds(['new', 'unknown']),
      expanded: leadKanbanColumnIds(['won', 'invalid']),
    })

    expect([...compact]).toEqual(['lost', 'not_interested', 'archived', 'new'])
  })

  it('preserves visible terminal columns from the legacy compact-column format', () => {
    const preferences = preferencesFromLegacyCompactColumns(['lost', 'not_interested', 'archived'])

    expect(preferences).toEqual({ compact: [], expanded: ['won'] })
    expect([...resolveCompactLeadKanbanColumns(preferences)]).toEqual([
      'lost',
      'not_interested',
      'archived',
    ])
  })

  it('returns a column to its default after toggling it twice', () => {
    const terminalOpened = toggleLeadKanbanColumnPreference(
      { compact: [], expanded: [] },
      'won',
    )
    const terminalClosed = toggleLeadKanbanColumnPreference(terminalOpened, 'won')
    const activeCollapsed = toggleLeadKanbanColumnPreference(
      { compact: [], expanded: [] },
      'new',
    )
    const activeVisible = toggleLeadKanbanColumnPreference(activeCollapsed, 'new')

    expect(terminalOpened).toEqual({ compact: [], expanded: ['won'] })
    expect(terminalClosed).toEqual({ compact: [], expanded: [] })
    expect(activeCollapsed).toEqual({ compact: ['new'], expanded: [] })
    expect(activeVisible).toEqual({ compact: [], expanded: [] })
  })
})
