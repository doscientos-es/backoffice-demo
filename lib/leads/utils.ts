type LeadNameSource = { name: string; alias?: string | null }

/**
 * Returns the lead's display name: the short `alias` when set, otherwise the
 * full `name`. Use this everywhere a lead is shown to users (lists, kanban,
 * drawers, page titles). Mirrors `clientDisplayName` in `lib/clients/utils.ts`.
 */
export function leadDisplayName(lead: LeadNameSource): string {
  return lead.alias?.trim() || lead.name
}

/** Computes the 1-2 letter initials shown in avatar badges, from the display name. */
export function getLeadInitials(lead: LeadNameSource): string {
  const parts = leadDisplayName(lead).trim().split(/\s+/)
  return parts.length >= 2 ? (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '') : (parts[0]?.[0] ?? '?')
}
