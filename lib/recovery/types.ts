import type { LeadMemberRef } from '@/lib/leads/types'
import type { LeadStatus } from '@/lib/status'

export const RECOVERY_LIST_PAGE_SIZE = 25
/** Upper bound for KPI aggregation so the dashboard query stays bounded. */
export const RECOVERY_KPI_LIMIT = 1000

/** Closable states that feed the recovery pipeline. */
export type RecoveryClosureStatus = Extract<LeadStatus, 'lost' | 'not_interested'>

/**
 * Where a lost lead sits in Sara's re-engagement funnel. Derived from outreach
 * interactions + campaign open/click tracking (see `getRecoveryState`).
 */
export type RecoveryState = 'pending' | 'contacted' | 'opened' | 'engaged'

/**
 * Raw signals used to compute a `RecoveryState`. Kept transport-agnostic so the
 * pure `getRecoveryState` reducer can be unit-tested without a DB.
 */
export type RecoverySignals = {
  /** A recovery email was sent or a call was logged after the lead was lost. */
  hasOutbound: boolean
  /** The lead opened a tracked recovery email. */
  opened: boolean
  /** The lead clicked a link in a tracked recovery email. */
  clicked: boolean
  /** The lead replied (inbound email) after being lost. */
  replied: boolean
}

/** A lost lead enriched with its computed recovery funnel position. */
export type RecoveryLead = {
  id: string
  name: string
  /** Optional short display name. Falls back to `name` when null. */
  alias: string | null
  company: string | null
  email: string | null
  phone: string | null
  source: string | null
  status: RecoveryClosureStatus
  estimated_value: number | null
  score: number | null
  lost_reason: string | null
  lost_at: string | null
  created_at: string
  assignee: LeadMemberRef | null
  recoveryState: RecoveryState
  /** Last outbound recovery touch (email/call) timestamp, if any. */
  lastContactedAt: string | null
  /** Number of outbound recovery touches since the lead was lost. */
  outreachCount: number
  /** Tracked email opens across recovery sends. Best-effort because clients can block pixels. */
  openCount: number
  /** Tracked link clicks across recovery sends. Stronger intent signal than opens. */
  clickCount: number
  lastOpenedAt: string | null
  lastClickedAt: string | null
}

export const RECOVERY_SORT_COLUMNS = [
  'name',
  'company',
  'estimated_value',
  'score',
  'lost_at',
] as const

export type RecoveryListParams = {
  q: string
  /** Filter by the free-text `lost_reason` value. */
  reason: string | null
  /** Narrow to `lost` or `not_interested`; null = both. */
  status: RecoveryClosureStatus | null
  assignee: string | null
  page: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type RecoveryListResult = {
  leads: RecoveryLead[]
  count: number
  error: string | null
}

/** Aggregate metrics for the recovery hub KPI cards. */
export type RecoveryKpis = {
  total: number
  byState: Record<RecoveryState, number>
  /** Sum of `estimated_value` across all open lost leads. */
  valueAtRisk: number
}
