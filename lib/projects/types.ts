/**
 * Shared types and constants for the projects domain.
 */

export const PROJECT_LIST_PAGE_SIZE = 25
export const PROJECT_TASKS_LIMIT = 20
export const PROJECT_RELATED_LIMIT = 10

// ─── List ─────────────────────────────────────────────────────────────────────

export type ProjectListItem = {
  id: string
  name: string
  status: string | null
  description: string | null
  updated_at: string | null
  client_id: string | null
  github_sync_mode: string | null
  github_repo: string | null
  client_name: string | null
}

export const PROJECT_SORT_COLUMNS = ['name', 'status', 'updated_at'] as const

export type ProjectListParams = {
  q?: string
  status?: string
  page?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type ProjectListResult = {
  data: ProjectListItem[]
  count: number
}

// ─── Detail (related rows) ────────────────────────────────────────────────────

export type ProjectDetailClient = {
  id: string
  name: string
  email: string | null
}

export type ProjectDetailTask = {
  id: string
  title: string
  status: string | null
}

export type ProjectDetailProposal = {
  id: string
  number: string | null
  title: string | null
  status: string | null
  total: string | number | null
}

export type ProjectDetailInvoice = {
  id: string
  full_number: string | null
  status: string | null
  total: string | number | null
  issue_date: string | null
}

export type ProjectClientOption = {
  id: string
  name: string
}

// ─── Full project record ───────────────────────────────────────────────────────

export type ProjectDetail = {
  id: string
  name: string
  status: string | null
  description: string | null
  starts_at: string | null
  ends_at: string | null
  github_sync_mode: string | null
  github_repo: string | null
  github_installation_id: number | null
  github_auto_sync: boolean | null
  github_repo_owner: string | null
  github_repo_name: string | null
  updated_at: string | null
}

export type ProjectDetailResult = {
  project: ProjectDetail
  client: ProjectDetailClient | null
  clients: ProjectClientOption[]
  tasks: ProjectDetailTask[]
  proposals: ProjectDetailProposal[]
  invoices: ProjectDetailInvoice[]
} | null
