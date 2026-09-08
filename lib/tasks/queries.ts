import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'
import { escapeIlike } from '@/lib/utils/search-params'

import {
  TASK_BOARD_LIMIT,
  TASK_LIST_PAGE_SIZE,
  type TaskBoardItem,
  type TaskBoardParams,
  type TaskBoardResult,
  type TaskDetailResult,
  type TaskListItem,
  type TaskListParams,
  type TaskListResult,
} from './types'

const log = scopedLogger('tasks.queries')

type TaskRow = {
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

export async function listTasksBoard(params: TaskBoardParams): Promise<TaskBoardResult> {
  const supabase = await createServerClient()

  let query = notDeleted(
    supabase
      .from('tasks')
      .select(
        'id, title, status, due_date, priority, projects(id, name), leads(id, name), clients(id, name), team_members:assignee_id(id, name)',
      ),
  ).eq('kind', 'task')

  if (params.q && params.q.length > 0) query = query.ilike('title', `%${escapeIlike(params.q)}%`)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.projectId) query = query.eq('project_id', params.projectId)
  if (params.assigneeId) query = query.eq('assignee_id', params.assigneeId)

  const { data, error } = await query
    .order('kanban_order', { ascending: true, nullsFirst: false })
    .limit(TASK_BOARD_LIMIT)

  if (error) log.error({ err: error.message }, 'list_tasks_board_failed')

  const rows = (data as unknown as TaskRow[]) ?? []
  const items: TaskBoardItem[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    project: t.projects ? { id: t.projects.id, name: t.projects.name } : null,
    lead: t.leads ? { id: t.leads.id, name: t.leads.name } : null,
    client: t.clients ? { id: t.clients.id, name: t.clients.name } : null,
    assignee_name: t.team_members?.name ?? null,
  }))

  return { items, capped: rows.length >= TASK_BOARD_LIMIT, error: error?.message ?? null }
}

export async function listTasksList(params: TaskListParams): Promise<TaskListResult> {
  const supabase = await createServerClient()
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * TASK_LIST_PAGE_SIZE
  const to = from + TASK_LIST_PAGE_SIZE - 1

  let query = notDeleted(
    supabase
      .from('tasks')
      .select(
        'id, title, status, due_date, priority, projects(id, name), leads(id, name), clients(id, name), team_members:assignee_id(id, name)',
        { count: 'exact' },
      ),
  ).eq('kind', 'task')

  if (params.q && params.q.length > 0) query = query.ilike('title', `%${escapeIlike(params.q)}%`)
  if (params.status) query = query.eq('status', params.status)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.projectId) query = query.eq('project_id', params.projectId)
  if (params.assigneeId) query = query.eq('assignee_id', params.assigneeId)

  const sortCol = params.sort ?? 'priority'
  const ascending = params.sort ? params.dir !== 'desc' : sortCol !== 'priority'
  const { data, error, count } = await query
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to)

  if (error) log.error({ err: error.message }, 'list_tasks_list_failed')

  return {
    data: (data as unknown as TaskListItem[]) ?? [],
    count: count ?? 0,
    error: error?.message ?? null,
  }
}

export async function getTaskDetail(id: string): Promise<TaskDetailResult> {
  const supabase = await createServerClient()

  const { data: task, error } = await notDeleted(
    supabase
      .from('tasks')
      .select(
        '*, projects(id, name, github_sync_mode, github_repo, github_repo_owner, github_repo_name), client:clients!client_id(id, name), leads(id, name), team_members:assignee_id(id, name), creator:created_by(id, name)',
      )
      .eq('id', id),
  ).maybeSingle()

  if (error) log.error({ taskId: id, err: error.message }, 'get_task_detail_failed')
  if (!task) return null

  const [{ data: members }, { data: commentsData }] = await Promise.all([
    notDeleted(supabase.from('team_members').select('id, name')).order('name'),
    supabase
      .from('task_comments')
      .select('id, body, created_at, author:author_id(id, name)')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
  ])

  type AnyRecord = Record<string, unknown>
  const raw = task as unknown as AnyRecord
  const project =
    (raw.projects as {
      id: string
      name: string
      github_sync_mode: string | null
      github_repo: string | null
      github_repo_owner: string | null
      github_repo_name: string | null
    } | null) ?? null
  const lead = (raw.leads as { id: string; name: string } | null) ?? null
  const directClient = (raw.client as { id: string; name: string } | null) ?? null
  const assignee = (raw.team_members as { id: string; name: string } | null) ?? null
  const creator = (raw.creator as { id: string; name: string } | null) ?? null

  return {
    task: {
      id: task.id as string,
      title: task.title as string,
      description: (task.description as string | null) ?? null,
      status: task.status as string,
      priority: task.priority as string,
      due_date: (task.due_date as string | null) ?? null,
      started_at: (task.started_at as string | null) ?? null,
      completed_at: (task.completed_at as string | null) ?? null,
      github_issue_url: (task.github_issue_url as string | null) ?? null,
      github_issue_number: (task.github_issue_number as number | null) ?? null,
    },
    project,
    lead,
    client: directClient ?? null,
    assignee,
    creator,
    members: (members ?? []) as Array<{ id: string; name: string }>,
    comments:
      (commentsData as unknown as Array<{
        id: string
        body: string
        created_at: string
        author: { id: string; name: string } | null
      }>) ?? [],
  }
}
