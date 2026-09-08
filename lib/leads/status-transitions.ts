export const LEAD_CLOSURE_STATUSES = ['lost', 'not_interested'] as const

export type LeadClosureStatus = (typeof LEAD_CLOSURE_STATUSES)[number]

export function isLeadClosureStatus(status: string): status is LeadClosureStatus {
  return (LEAD_CLOSURE_STATUSES as readonly string[]).includes(status)
}

/** Builds the only supported persistence patch for a manual pipeline transition. */
export function buildLeadStatusPatch({
  status,
  lostReason,
  userId,
  now,
}: {
  status: string
  lostReason?: string | null
  userId: string
  now: string
}): Record<string, string | null> {
  if (isLeadClosureStatus(status)) {
    return {
      status,
      lost_reason: lostReason ?? null,
      lost_at: now,
      updated_at: now,
      updated_by: userId,
    }
  }

  return {
    status,
    lost_reason: null,
    lost_at: null,
    updated_at: now,
    updated_by: userId,
  }
}

/** A connected call may promote only a brand new lead, never a later stage. */
export function canPromoteLeadAfterConnectedCall(status: string | null | undefined): boolean {
  return status === 'new'
}

/** Manual and legacy values must never be overwritten by call-derived qualification. */
export function canAutomateLeadAccessibility({
  value,
  source,
}: {
  value: boolean | null
  source: string | null
}): boolean {
  return source === 'auto' || (source === null && value === null)
}
