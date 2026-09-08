import type { ReminderRow } from '@/lib/dashboard/types'
import type { LeadNextAction } from '@/lib/leads/pipeline'
import type { LeadStatus } from '@/lib/status'

export const LEAD_LIST_PAGE_SIZE = 25
export const LEAD_BOARD_LIMIT = 500
export const RECENT_INTERACTIONS_PER_LEAD = 3
export const LEAD_RELATED_LIMIT = 5

/**
 * Lightweight reference to a `team_members` row, used both for a lead's
 * owner (`assigned_to`) and for the author of an interaction
 * (`performed_by`). Carries the fields `memberAvatarUrl` needs to resolve
 * an avatar plus an initials fallback.
 */
export type LeadMemberRef = {
  id: string
  name: string
  avatar_url: string | null
  github_handle: string | null
}

/** Minimal client reference used to show a converted lead's logo. */
export type LeadClientRef = {
  name: string
  logo_url: string | null
}

export type LeadInteraction = {
  id: string
  type: string
  subject: string | null
  body: string | null
  created_at: string
  performer: LeadMemberRef | null
}

export type LeadListItem = {
  id: string
  /** Internal optimistic-concurrency token. */
  version: number
  name: string
  /** Optional short display name. Falls back to `name` when null. */
  alias: string | null
  company: string | null
  email: string | null
  phone: string | null
  source: string | null
  notes: string | null
  status: LeadStatus
  created_at: string
  updated_at: string
  estimated_value: number | null
  score: number | null
  /** Firmographic + intent signals parsed from the lead form. */
  company_size: string | null
  solution_type: string | null
  urgency: string | null
  /** Speed-to-lead: first time a sales rep engaged the lead. */
  first_contacted_at: string | null
  landing_path: string | null
  landing_ref: string | null
  landing_subject: string | null
  conversion_step: string | null
  first_landing_path: string | null
  utm_campaign: string | null
  /** Resolved name from Meta's synced campaign catalog. */
  marketing_campaign_name: string | null
  last_utm_source: string | null
  last_utm_campaign: string | null
  ai_summary: string | null
  ai_updated_at: string | null
  lost_reason: string | null
  lost_at: string | null
  client: LeadClientRef | null
  assignee: LeadMemberRef | null
  recent_interactions: LeadInteraction[]
  /** Soonest pending reminder; drives the "próxima acción" chip on the board. */
  next_action: LeadNextAction | null
  /** Earliest future call or meeting, independently of the soonest next action. */
  scheduled_meeting_at: string | null
  /** Duration from today's latest scheduled meeting, used to prefill call logging. */
  scheduled_meeting_duration_minutes: number | null
}

export type LeadListView = 'board' | 'list'

export type LeadAttentionFilter = 'stale' | 'unassigned' | 'urgent'

export const LEAD_SORT_COLUMNS = [
  'name',
  'company',
  'status',
  'estimated_value',
  'score',
  'created_at',
] as const

export type LeadListParams = {
  view: LeadListView
  ids?: string[]
  q: string
  status: LeadStatus | null
  source: string | null
  solutionType: string | null
  assignee: string | null
  attention: LeadAttentionFilter | null
  page: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type LeadListResult = {
  leads: LeadListItem[]
  count: number
  error: string | null
}

export type LeadDetailAiTemperature = 'hot' | 'warm' | 'cold'

export type LeadCompanyResearch = {
  domain: string
  description: string
  sector: string | null
  services: string[]
  location: string | null
  company_size: string | null
  fit: string
  priority: 'high' | 'medium' | 'low'
  confidence: number
  reasons: string[]
  cautions: string[]
  sources: Array<{ title: string; url: string; excerpt: string }>
}

export type LeadDetail = {
  id: string
  /** Internal optimistic-concurrency token. */
  version: number
  name: string
  /** Optional short display name. Falls back to `name` when null. */
  alias: string | null
  email: string | null
  phone: string | null
  company: string | null
  source: string | null
  status: LeadStatus
  notes: string | null
  estimated_value: number | null
  score: number | null
  company_size: string | null
  solution_type: string | null
  urgency: string | null
  first_contacted_at: string | null
  landing_path: string | null
  landing_ref: string | null
  landing_subject: string | null
  event_id: string | null
  conversion_step: string | null
  first_landing_path: string | null
  first_referrer: string | null
  first_utm_source: string | null
  first_utm_medium: string | null
  first_utm_campaign: string | null
  first_utm_term: string | null
  first_utm_content: string | null
  utm_campaign: string | null
  /** Meta's ad ID for instant-form leads; stored in UTM content for attribution. */
  utm_content: string | null
  /** Resolved name from Meta's synced campaign catalog. */
  marketing_campaign_name: string | null
  /** Resolved name from Meta's synced ad catalog. */
  marketing_ad_name: string | null
  last_landing_path: string | null
  last_referrer: string | null
  last_utm_source: string | null
  last_utm_medium: string | null
  last_utm_campaign: string | null
  last_utm_term: string | null
  last_utm_content: string | null
  calculator_cost: string | null
  calculator_hours: string | null
  created_at: string
  updated_at: string | null
  ai_summary: string | null
  ai_suggested_next_step: string | null
  ai_suggested_next_step_at: string | null
  ai_temperature: LeadDetailAiTemperature | null
  ai_confidence: number | null
  ai_updated_at: string | null
  ai_tags: string[] | null
  /** Public-company research; always kept separate from lead-submitted CRM fields. */
  company_research: LeadCompanyResearch | null
  company_researched_at: string | null
  lost_reason: string | null
  lost_at: string | null
  assigned_to: string | null
  assignee: LeadMemberRef | null
  /** Mom Test qualification signals — tri-state, null until marked. */
  mom_test_real_problem: boolean | null
  mom_test_aware_problem: boolean | null
  mom_test_tried_solutions: boolean | null
  mom_test_decision_power_or_budget: boolean | null
  mom_test_accessible: boolean | null
}

export type LeadDetailInteraction = LeadInteraction & {
  payload: unknown
  resend_email_id: string | null
}

/** Related records shown as commercial shortcuts on the lead detail page. */
export type LeadRelatedProposal = {
  id: string
  number: string | null
  title: string | null
  status: string | null
  total: number | null
  valid_until: string | null
  sent_at: string | null
  viewed_at: string | null
  responded_at: string | null
  notes: string | null
}

export type LeadRelatedProject = {
  id: string
  name: string
  status: string | null
  description: string | null
}

export type LeadRelatedInvoice = {
  id: string
  full_number: string | null
  status: string | null
  total: number | null
  issue_date: string | null
}

export type LeadRelatedTask = {
  id: string
  title: string
  status: string
  due_date: string | null
  description: string | null
  priority: string | null
}

export type LeadRelatedAttachment = {
  name: string
  mime_type: string | null
}

export type LeadDetailResult = {
  lead: LeadDetail
  /** False when the optional company-research schema is unavailable. */
  companyResearchAvailable: boolean
  interactions: LeadDetailInteraction[]
  linkedClientId: string | null
  linkedClientName: string | null
  proposals: LeadRelatedProposal[]
  projects: LeadRelatedProject[]
  invoices: LeadRelatedInvoice[]
  /** Tasks directly associated with this lead, newest first. */
  tasks: LeadRelatedTask[]
  /** Pending reminders scheduled against this lead, soonest first. */
  reminders: ReminderRow[]
  attachments: LeadRelatedAttachment[]
}

export type LeadConvertSeed = {
  id: string
  name: string
  alias: string | null
  email: string | null
  phone: string | null
  company: string | null
  notes: string | null
}

export type LeadConvertResult = {
  lead: LeadConvertSeed
  existingClientId: string | null
}
