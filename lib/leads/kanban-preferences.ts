import {
  DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS,
  LEAD_KANBAN_COLUMNS,
  type LeadKanbanColumnId,
} from './kanban-policy'

export type LeadKanbanColumnPreferences = {
  compact: LeadKanbanColumnId[]
  expanded: LeadKanbanColumnId[]
}

const columnIds = new Set<LeadKanbanColumnId>(LEAD_KANBAN_COLUMNS.map((column) => column.id))

export function leadKanbanColumnIds(value: unknown): LeadKanbanColumnId[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (id): id is LeadKanbanColumnId =>
      typeof id === 'string' && columnIds.has(id as LeadKanbanColumnId),
  )
}

export function resolveCompactLeadKanbanColumns(
  preferences: LeadKanbanColumnPreferences,
): Set<LeadKanbanColumnId> {
  const compact = new Set(DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS)
  for (const id of preferences.compact) compact.add(id)
  for (const id of preferences.expanded) compact.delete(id)
  return compact
}

export function preferencesFromLegacyCompactColumns(
  compactColumns: LeadKanbanColumnId[],
): LeadKanbanColumnPreferences {
  const compact = new Set(compactColumns)
  return {
    compact: compactColumns.filter((id) => !DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS.includes(id)),
    expanded: DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS.filter((id) => !compact.has(id)),
  }
}

export function toggleLeadKanbanColumnPreference(
  preferences: LeadKanbanColumnPreferences,
  id: LeadKanbanColumnId,
): LeadKanbanColumnPreferences {
  const shouldCompact = !resolveCompactLeadKanbanColumns(preferences).has(id)
  const compact = new Set(preferences.compact)
  const expanded = new Set(preferences.expanded)

  compact.delete(id)
  expanded.delete(id)
  const isCompactByDefault = DEFAULT_COMPACT_LEAD_KANBAN_COLUMNS.includes(id)
  if (shouldCompact !== isCompactByDefault) {
    if (shouldCompact) compact.add(id)
    else expanded.add(id)
  }

  return { compact: [...compact], expanded: [...expanded] }
}
