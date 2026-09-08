/**
 * Shared types and constants for the tasks domain.
 */

export const TASK_LIST_PAGE_SIZE = 25
export const TASK_BOARD_LIMIT = 200

// ─── Board ────────────────────────────────────────────────────────────────────

export type TaskBoardItem = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  project: { id: string; name: string } | null
  lead: { id: string; name: string } | null
  client: { id: string; name: string } | null
  assignee_name: string | null
}

export type TaskBoardParams = {
  q?: string
  priority?: string
  projectId?: string
  assigneeId?: string
}

export type TaskBoardResult = {
  items: TaskBoardItem[]
  capped: boolean
  error: string | null
}

// ─── List ─────────────────────────────────────────────────────────────────────

export type TaskListItem = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  projects: { id: string; name: string } | null
  leads: { id: string; name: string } | null
  clients: { id: string; name: string } | null
  team_members: { id: string; name: string } | null
}

export const TASK_SORT_COLUMNS = ['title', 'status', 'priority', 'due_date'] as const

export type TaskListParams = {
  q?: string
  status?: string
  priority?: string
  projectId?: string
  assigneeId?: string
  page?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export type TaskListResult = {
  data: TaskListItem[]
  count: number
  error: string | null
}

// ─── Detail ────────────────────────────────────────────────────────────────────

export type TaskDetailProject = {
  id: string
  name: string
  github_sync_mode: string | null
  github_repo: string | null
  github_repo_owner: string | null
  github_repo_name: string | null
}

export type TaskDetailLead = {
  id: string
  name: string
}

export type TaskDetailClient = {
  id: string
  name: string
}

export type TaskDetailMember = {
  id: string
  name: string
}

export type TaskDetailComment = {
  id: string
  body: string
  created_at: string
  author: { id: string; name: string } | null
}

export type TaskDetail = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  github_issue_url: string | null
  github_issue_number: number | null
}

export type TaskDetailResult = {
  task: TaskDetail
  project: TaskDetailProject | null
  lead: TaskDetailLead | null
  client: TaskDetailClient | null
  assignee: TaskDetailMember | null
  creator: TaskDetailMember | null
  members: TaskDetailMember[]
  comments: TaskDetailComment[]
} | null
