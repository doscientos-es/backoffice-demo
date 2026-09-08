import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

import {
  PROJECT_LIST_PAGE_SIZE,
  PROJECT_RELATED_LIMIT,
  PROJECT_TASKS_LIMIT,
  type ProjectDetailResult,
  type ProjectListParams,
  type ProjectListResult,
} from './types'

const log = scopedLogger('projects.queries')

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`)
}

export async function listProjects(params: ProjectListParams): Promise<ProjectListResult> {
  const supabase = await createServerClient()
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * PROJECT_LIST_PAGE_SIZE
  const to = from + PROJECT_LIST_PAGE_SIZE - 1

  let query = notDeleted(
    supabase
      .from('projects')
      .select(
        'id, name, status, description, updated_at, client_id, github_sync_mode, github_repo, clients(name)',
        { count: 'exact' },
      ),
  )

  if (params.q && params.q.length > 0) query = query.ilike('name', `%${escapeIlike(params.q)}%`)
  if (params.status) query = query.eq('status', params.status)

  const sortCol = params.sort ?? 'created_at'
  const ascending = params.sort ? params.dir !== 'desc' : false
  const { data, error, count } = await query
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to)

  if (error) log.error({ err: error.message }, 'list_projects_failed')

  return {
    data: (data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      status: (p.status as string | null) ?? null,
      description: (p.description as string | null) ?? null,
      updated_at: (p.updated_at as string | null) ?? null,
      client_id: (p.client_id as string | null) ?? null,
      github_sync_mode: (p.github_sync_mode as string | null) ?? null,
      github_repo: (p.github_repo as string | null) ?? null,
      client_name: (p as unknown as { clients: { name: string } | null }).clients?.name ?? null,
    })),
    count: count ?? 0,
  }
}

export async function getProjectDetail(
  id: string,
  options: { includeClients?: boolean } = {},
): Promise<ProjectDetailResult> {
  const supabase = await createServerClient()

  const { data: project, error } = await notDeleted(
    supabase.from('projects').select('*, clients(id, name, email)').eq('id', id),
  ).maybeSingle()

  if (error) log.error({ projectId: id, err: error.message }, 'get_project_detail_failed')
  if (!project) return null

  const clientRow = (
    project as unknown as { clients: { id: string; name: string; email: string | null } | null }
  ).clients

  const [clientsResult, { data: tasks }, { data: proposals }, { data: invoices }] =
    await Promise.all([
      options.includeClients
        ? notDeleted(supabase.from('clients').select('id, name')).order('name')
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      notDeleted(supabase.from('tasks').select('id, title, status').eq('project_id', id))
        .order('created_at', { ascending: false })
        .limit(PROJECT_TASKS_LIMIT),
      notDeleted(
        supabase.from('proposals').select('id, number, title, status, total').eq('project_id', id),
      )
        .order('created_at', { ascending: false })
        .limit(PROJECT_RELATED_LIMIT),
      notDeleted(
        supabase
          .from('invoices')
          .select('id, full_number, status, total, issue_date')
          .eq('project_id', id),
      )
        .order('issue_date', { ascending: false })
        .limit(PROJECT_RELATED_LIMIT),
    ])

  return {
    project: {
      id: project.id as string,
      name: project.name as string,
      status: (project.status as string | null) ?? null,
      description: (project.description as string | null) ?? null,
      starts_at: (project.starts_at as string | null) ?? null,
      ends_at: (project.ends_at as string | null) ?? null,
      github_sync_mode: (project.github_sync_mode as string | null) ?? null,
      github_repo: (project.github_repo as string | null) ?? null,
      github_installation_id: (project.github_installation_id as number | null) ?? null,
      github_auto_sync: (project.github_auto_sync as boolean | null) ?? null,
      github_repo_owner: (project.github_repo_owner as string | null) ?? null,
      github_repo_name: (project.github_repo_name as string | null) ?? null,
      updated_at: (project.updated_at as string | null) ?? null,
    },
    client: clientRow ?? null,
    clients: (clientsResult.data ?? []) as Array<{ id: string; name: string }>,
    tasks: (tasks ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      status: (t.status as string | null) ?? null,
    })),
    proposals: (proposals ?? []).map((p) => ({
      id: p.id as string,
      number: (p.number as string | null) ?? null,
      title: (p.title as string | null) ?? null,
      status: (p.status as string | null) ?? null,
      total: p.total ?? null,
    })),
    invoices: (invoices ?? []).map((i) => ({
      id: i.id as string,
      full_number: (i.full_number as string | null) ?? null,
      status: (i.status as string | null) ?? null,
      total: i.total ?? null,
      issue_date: (i.issue_date as string | null) ?? null,
    })),
  }
}

/**
 * Read model for the project workspace. It intentionally owns every query used
 * by the detail screen so pages remain composition-only server components.
 */
export async function getProjectWorkspace(
  id: string,
  options: { includeClients: boolean; tasksView: 'board' | 'list' },
) {
  const supabase = await createServerClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select('*, clients(id, name, email, lead_id)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) log.error({ projectId: id, err: error.message }, 'get_project_workspace_failed')
  if (!project) return null

  const client = (
    project as unknown as {
      clients: { id: string; name: string; email: string | null; lead_id: string | null } | null
    }
  ).clients
  const clientsResult = options.includeClients
    ? await supabase.from('clients').select('id, name').is('deleted_at', null).order('name')
    : { data: [] as Array<{ id: string; name: string }> }

  const [
    { data: tasks },
    { data: proposals },
    { data: invoices },
    { data: members },
    { data: attachments },
    { data: workLogsData },
    { data: invoiceTotals },
    { data: expenseTotals },
    { data: settings },
    { data: checklistData },
    { data: unlinkedProposals },
    { data: reminders },
    { data: clientRequests },
    { data: webProjects },
  ] = await Promise.all([
    options.tasksView === 'board'
      ? supabase
          .from('tasks')
          .select(
            'id, title, status, priority, due_date, kanban_order, team_members:assignee_id(id, name)',
          )
          .eq('project_id', id)
          .is('deleted_at', null)
          .order('kanban_order', { ascending: true })
      : supabase
          .from('tasks')
          .select('id, title, status')
          .eq('project_id', id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(PROJECT_TASKS_LIMIT),
    supabase
      .from('proposals')
      .select('id, number, title, status, total')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(PROJECT_RELATED_LIMIT),
    supabase
      .from('invoices')
      .select('id, full_number, status, total, issue_date')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })
      .limit(PROJECT_RELATED_LIMIT),
    supabase.from('team_members').select('id, name').is('deleted_at', null).order('name'),
    supabase
      .from('attachments')
      .select('id, name, mime_type, size_bytes, created_at, source, drive_file_id, web_view_link')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('work_logs')
      .select(
        'id, work_date, start_time, end_time, hours, note, team_members:member_id(id, name, avatar_url, github_handle)',
      )
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('work_date', { ascending: false }),
    supabase.from('invoices').select('total, status').eq('project_id', id).is('deleted_at', null),
    supabase
      .from('expenses')
      .select('total')
      .eq('project_id', id)
      .is('deleted_at', null)
      .neq('status', 'cancelled'),
    supabase.from('settings').select('internal_hourly_cost').eq('id', 1).maybeSingle(),
    supabase
      .from('project_checklist_items')
      .select('id, label, is_done, position')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('position'),
    client
      ? supabase
          .from('proposals')
          .select('id, number, title')
          .or(
            client.lead_id
              ? `client_id.eq.${client.id},lead_id.eq.${client.lead_id}`
              : `client_id.eq.${client.id}`,
          )
          .is('project_id', null)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('tasks')
      .select('id, title, start_at')
      .eq('kind', 'reminder')
      .eq('project_id', id)
      .is('completed_at', null)
      .is('deleted_at', null)
      .order('start_at', { ascending: true })
      .limit(PROJECT_RELATED_LIMIT),
    supabase
      .from('project_requests')
      .select('id, category, subject, body, status, requester_name, requester_email, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('web_projects')
      .select('id, name, url, is_client_visible')
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('name'),
  ])

  return {
    project,
    client,
    clients: clientsResult.data ?? [],
    tasks: tasks ?? [],
    proposals: proposals ?? [],
    invoices: invoices ?? [],
    members: members ?? [],
    attachments: attachments ?? [],
    workLogsData: workLogsData ?? [],
    invoiceTotals: invoiceTotals ?? [],
    expenseTotals: expenseTotals ?? [],
    settings,
    checklistData: checklistData ?? [],
    unlinkedProposals: unlinkedProposals ?? [],
    reminders: reminders ?? [],
    clientRequests: clientRequests ?? [],
    webProjects: webProjects ?? [],
  }
}
