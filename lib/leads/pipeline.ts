/**
 * Single source of truth for the commercial pipeline: which stages are still
 * in play, how long a lead may sit in each one before it rots, and what the
 * "next action" on a card is.
 *
 * The stages are deliberately factual — each one answers a question that can
 * be verified from the timeline instead of relying on the rep's judgement:
 *   new             → nobody has reached out yet
 *   contacted       → we reached out; waiting for a reply
 *   in_conversation → the lead replied; the conversation is alive
 *   quoted          → a proposal is on their table
 *
 * `qualifying` is the legacy stage those two replaced. It stays in the enum
 * (Postgres cannot drop enum values) and is folded into `in_conversation`
 * everywhere the board groups leads.
 */

import type { ReminderActionType } from '@/lib/reminders/action-types'
import type { LeadStatus } from '@/lib/status'

/** Stages that still require human follow-up (the rest are closed/parked). */
export const ACTIVE_LEAD_STATUSES = [
  'new',
  'contacted',
  'in_conversation',
  'qualifying',
  'quoted',
] as const

export const TERMINAL_LEAD_STATUSES = ['won', 'lost', 'not_interested', 'archived'] as const

/** Closed-out stages, used by the recovery funnel and the closure dialogs. */
export const CLOSURE_LEAD_STATUSES = ['lost', 'not_interested'] as const

const ACTIVE_SET: ReadonlySet<LeadStatus> = new Set(ACTIVE_LEAD_STATUSES)
const TERMINAL_SET: ReadonlySet<LeadStatus> = new Set(TERMINAL_LEAD_STATUSES)

export const isActiveLeadStatus = (status: LeadStatus): boolean => ACTIVE_SET.has(status)
export const isTerminalLeadStatus = (status: LeadStatus): boolean => TERMINAL_SET.has(status)

/**
 * Board column a status renders into. Only `qualifying` differs from the
 * identity mapping: legacy rows land in `in_conversation` so no lead is
 * stranded in a column that is no longer offered.
 */
export function boardColumnFor(status: LeadStatus): LeadStatus {
  return status === 'qualifying' ? 'in_conversation' : status
}

/** Statuses offered in selects and filters: everything except the legacy one. */
export const SELECTABLE_LEAD_STATUSES = [
  'new',
  'contacted',
  'in_conversation',
  'quoted',
  'won',
  'lost',
  'not_interested',
  'archived',
] as const

/**
 * Enum values a status filter has to match. Filtering by `in_conversation`
 * must also return the legacy `qualifying` rows, since the board folds them
 * into that column.
 */
export function statusFilterValues(status: LeadStatus): LeadStatus[] {
  return status === 'in_conversation' ? ['in_conversation', 'qualifying'] : [status]
}

/**
 * Stage-specific rotting thresholds, in days without activity. A brand new
 * lead rots in a day (speed-to-lead), while a sent quote can reasonably sit
 * for a week before it needs a nudge. Terminal stages never rot.
 */
export const STAGE_ROT_DAYS: Readonly<Record<LeadStatus, number | null>> = {
  new: 1,
  contacted: 3,
  in_conversation: 5,
  qualifying: 5,
  quoted: 7,
  won: null,
  lost: null,
  not_interested: null,
  archived: null,
}

const DAY_MS = 24 * 60 * 60 * 1000

/** True when the lead has sat in its stage longer than that stage allows. */
export function isRotting(status: LeadStatus, lastActivityAt: string): boolean {
  const days = STAGE_ROT_DAYS[status]
  if (days == null) return false
  return Date.now() - new Date(lastActivityAt).getTime() > days * DAY_MS
}

// ---------------------------------------------------------------------------
// Next action
// ---------------------------------------------------------------------------

/** Pending reminder driving the card, mirrors `tasks` where `kind='reminder'`. */
export type LeadNextAction = {
  id: string
  title: string
  remind_at: string
  action_type: ReminderActionType
}

/**
 * `missing` is the one that matters: an active lead with nothing scheduled is
 * how deals quietly die, so the board surfaces it as loudly as an overdue one.
 */
export type NextActionState = 'overdue' | 'today' | 'scheduled' | 'missing' | 'none'

export function nextActionState(
  status: LeadStatus,
  nextAction: LeadNextAction | null,
  now = new Date(),
): NextActionState {
  if (!nextAction) return isActiveLeadStatus(status) ? 'missing' : 'none'
  const due = new Date(nextAction.remind_at).getTime()
  if (due < now.getTime()) return 'overdue'
  const endOfToday = new Date()
  endOfToday.setTime(now.getTime())
  endOfToday.setHours(23, 59, 59, 999)
  return due <= endOfToday.getTime() ? 'today' : 'scheduled'
}

/** Sort weight: the riskiest cards float to the top of their column. */
const NEXT_ACTION_RANK: Readonly<Record<NextActionState, number>> = {
  overdue: 0,
  missing: 1,
  today: 2,
  scheduled: 3,
  none: 4,
}

export const nextActionRank = (state: NextActionState): number => NEXT_ACTION_RANK[state]

// ---------------------------------------------------------------------------
// Conversation direction
// ---------------------------------------------------------------------------

/** Interaction types that represent a real touch, either way. */
const OUTBOUND_TYPES: ReadonlySet<string> = new Set(['email_sent', 'call'])
const INBOUND_TYPES: ReadonlySet<string> = new Set(['email_received', 'meeting'])

/**
 * Timestamp of our last outbound touch when nothing came back after it — i.e.
 * the ball is in their court. Returns null when they answered last or when
 * there is no real touch yet. Notes and status/owner changes are internal
 * bookkeeping and are skipped.
 * Expects `interactions` newest-first, as `recent_interactions` is loaded.
 */
export function waitingForReplySince(
  interactions: readonly { type: string; created_at: string }[],
): string | null {
  for (const i of interactions) {
    if (INBOUND_TYPES.has(i.type)) return null
    if (OUTBOUND_TYPES.has(i.type)) return i.created_at
  }
  return null
}
