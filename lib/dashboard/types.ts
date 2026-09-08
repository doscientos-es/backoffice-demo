/**
 * Shared types for the inicio (dashboard) widgets.
 * Keeping them in `lib/` decouples the data layer from the UI components.
 */

import type { LeadStatus, TaskPriority, TaskStatus } from '@/lib/status'

export type DashboardRange = '7d' | '30d' | '90d' | 'ytd'

export type DateWindow = {
  from: Date
  to: Date
}

export type DateRange = {
  current: DateWindow
  previous: DateWindow
}

export type TrendDirection = 'up' | 'down' | 'flat'

export type Trend = {
  delta: number // signed percentage, e.g. 12.5 means +12.5%
  direction: TrendDirection
}

export type ReminderRow = {
  id: string
  title: string
  remind_at: string
}

export type VerifactuPendingRow = {
  id: string
  full_number: string | null
  verifactu_status: 'pending' | 'error' | 'rejected'
  verifactu_error: string | null
  client_name: string | null
}

export type OverdueInvoiceRow = {
  id: string
  full_number: string | null
  due_date: string | null
  total: number
  client_name: string | null
}

export type RevenuePoint = {
  month: string // localized short month label, e.g. "ene"
  current: number
  previous: number
}

// ---------------------------------------------------------------------------
// Company goals
// ---------------------------------------------------------------------------

export type GoalMetric = 'leads_new' | 'revenue' | 'conversion_rate'

/** Map of metric → raw numeric target. Only metrics with a set goal appear. */
export type CompanyGoals = Partial<Record<GoalMetric, number>>

// ---------------------------------------------------------------------------

export type DashboardKpis = {
  leadsNew: number
  leadsNewPrev: number
  proposalsOpen: number
  proposalsOpenPrev: number
  overdueCount: number
  monthRevenue: number
  monthRevenuePrev: number
  pipelineValue: number
  conversionRate: number // 0..1
  conversionRatePrev: number
}

export type AvisosData = {
  reminders: ReminderRow[]
  verifactuPending: VerifactuPendingRow[]
  overdueInvoices: OverdueInvoiceRow[]
  certExpiresAt: string | null
}

/**
 * "Tu día" — the personal, action-oriented layer of the dashboard. Surfaces
 * what the logged-in member should act on today: their open tasks, the leads
 * they own that need follow-up, and unassigned leads they can claim.
 */
export type MyTaskRow = {
  id: string
  title: string
  kind: 'task' | 'reminder'
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  action_at: string | null
  contextLabel: string | null // project or lead name the task belongs to
  assigneeName: string | null
}

export type ActionLeadRow = {
  id: string
  name: string
  /** Optional short display name. Falls back to `name` when null. */
  alias: string | null
  company: string | null
  phone: string | null
  email: string | null
  status: LeadStatus
  /** Timestamp used for relative time: last update (my leads) or creation (unassigned). */
  since: string
  assigneeName: string | null
}

export type MyDayData = {
  tasks: MyTaskRow[]
  myLeads: ActionLeadRow[]
  unassignedLeads: ActionLeadRow[]
}

/**
 * Snapshot of Accounts Receivable for the dashboard tile: total outstanding
 * (issued + overdue), how much of it is overdue, and how much was already
 * collected within the current calendar month.
 */
export type AccountsReceivable = {
  pendingTotal: number
  pendingCount: number
  overdueTotal: number
  overdueCount: number
  paidMonthTotal: number
  paidMonthCount: number
}

/**
 * Current-month finance snapshot for the dashboard tile: invoiced revenue,
 * registered expenses, the resulting net and the dominant expense category.
 */
export type MonthFinanceSummary = {
  revenueMonth: number
  expenseMonth: number
  netMonth: number
  margin: number | null
  topCategory: { category: string; label: string; total: number } | null
}

// ---------------------------------------------------------------------------
// Money opportunities
// ---------------------------------------------------------------------------

export type MoneyProposalRow = {
  id: string
  number: string | null
  title: string
  status: 'sent' | 'viewed'
  total: number
  client_name: string | null
  lead_name: string | null
  updated_at: string
}

export type AcceptedUninvoicedRow = {
  id: string
  number: string | null
  title: string
  total: number
  invoiced_total: number
  remaining_total: number
  client_name: string | null
  updated_at: string
}

export type PriorityLeadRow = {
  id: string
  name: string
  company: string | null
  status: Extract<LeadStatus, 'new' | 'contacted' | 'in_conversation' | 'qualifying' | 'quoted'>
  source: string | null
  score: number | null
  estimated_value: number | null
  urgency: string | null
  solution_type: string | null
  updated_at: string
  stale: boolean
  has_next_action: boolean
}

export type RecoverableLeadRow = {
  id: string
  name: string
  company: string | null
  source: string | null
  lost_reason: string | null
  signal: string
  updated_at: string
}

export type MoneyOpportunities = {
  openProposalsTotal: number
  acceptedUninvoicedTotal: number
  priorityPipelineTotal: number
  recoverableCount: number
  openProposals: MoneyProposalRow[]
  acceptedUninvoiced: AcceptedUninvoicedRow[]
  priorityLeads: PriorityLeadRow[]
  recoverableLeads: RecoverableLeadRow[]
}
