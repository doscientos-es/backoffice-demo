import type { Metadata } from 'next'
import Link from 'next/link'

import { ListControls } from '@/components/layout/list-controls'
import { ListPage } from '@/components/layout/list-page'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { requireUser } from '@/lib/auth'
import { TASK_PRIORITY, TASK_STATUS, type TaskPriority, type TaskStatus } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'
import { listTasksBoard, listTasksList } from '@/lib/tasks/queries'
import { TASK_LIST_PAGE_SIZE, TASK_SORT_COLUMNS } from '@/lib/tasks/types'
import { formatDate } from '@/lib/utils'
import { parsePage, parseSortParam, parseStringParam } from '@/lib/utils/search-params'

import { TaskCreateDialog } from './task-create-dialog'
import { TaskRowActions } from './task-row-actions'
import { type KanbanTask, TasksKanban } from './tasks-kanban'
import { TasksViewToggle } from './view-toggle'

export const metadata: Metadata = { title: 'Tareas · doscientos' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = (Object.keys(TASK_STATUS) as TaskStatus[]).map((value) => ({
  value,
  label: TASK_STATUS[value].label,
}))

const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low']
const PRIORITY_OPTIONS = PRIORITY_ORDER.map((value) => ({
  value,
  label: TASK_PRIORITY[value].label,
}))

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const sp = await searchParams
  const view: 'board' | 'list' = parseStringParam(sp, 'view') === 'list' ? 'list' : 'board'
  const q = parseStringParam(sp, 'q')
  const status = parseStringParam(sp, 'status')
  const priority = parseStringParam(sp, 'priority')
  const projectId = parseStringParam(sp, 'project')
  const assigneeParam = parseStringParam(sp, 'assignee')
  const page = parsePage(sp)
  const { sort, dir } = parseSortParam(sp, TASK_SORT_COLUMNS, 'priority', 'desc')

  const supabase = await createServerClient()

  const [{ data: projects }, { data: leads }, { data: clients }, { data: members }] =
    await Promise.all([
      supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('leads').select('id, name').is('deleted_at', null).order('created_at', {
        ascending: false,
      }),
      supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('team_members').select('id, name').is('deleted_at', null).order('name'),
    ])

  const projectsList = (projects ?? []) as Array<{ id: string; name: string }>
  const leadsList = (leads ?? []) as Array<{ id: string; name: string }>
  const clientsList = (clients ?? []) as Array<{ id: string; name: string }>
  const membersList = (members ?? []) as Array<{ id: string; name: string }>

  const PROJECT_OPTIONS = projectsList.map((p) => ({ value: p.id, label: p.name }))
  const ASSIGNEE_OPTIONS = membersList.map((member) => ({ value: member.id, label: member.name }))
  const assigneeId = membersList.some((member) => member.id === assigneeParam) ? assigneeParam : ''

  if (view === 'board') {
    const {
      items,
      capped,
      error: boardErr,
    } = await listTasksBoard({
      q,
      priority,
      projectId,
      assigneeId,
    })
    const tasks = items as KanbanTask[]

    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Tareas"
          description="Organiza el trabajo del equipo y relaciónalo opcionalmente con proyectos, leads o clientes."
          actions={
            <div className="flex items-center gap-2">
              <TasksViewToggle view={view} />
              <TaskCreateDialog
                projects={projectsList}
                leads={leadsList}
                clients={clientsList}
                members={membersList}
                currentUserId={user.id}
              />
            </div>
          }
        />
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <ListControls
            searchKey="q"
            searchPlaceholder="Buscar por título…"
            filters={[
              { key: 'project', label: 'Proyecto', options: PROJECT_OPTIONS, searchable: true },
              { key: 'priority', label: 'Prioridad', options: PRIORITY_OPTIONS },
              {
                key: 'assignee',
                label: 'Responsable',
                options: ASSIGNEE_OPTIONS,
                searchable: true,
              },
            ]}
            className="border-b-0"
          />
        </div>
        {boardErr ? (
          <p className="text-destructive text-sm">{boardErr}</p>
        ) : (
          <TasksKanban
            tasks={tasks}
            capped={capped}
            projects={projectsList}
            leads={leadsList}
            clients={clientsList}
            members={membersList}
            currentUserId={user.id}
          />
        )}
      </div>
    )
  }

  const { data, count, error } = await listTasksList({
    q,
    status,
    priority,
    projectId,
    assigneeId,
    page,
    sort,
    dir,
  })

  const rows = data.map((t) => ({
    id: t.id,
    href: `/tasks/${t.id}`,
    csvValues: [
      t.title,
      [t.projects?.name, t.leads?.name, t.clients?.name].filter(Boolean).join(' · '),
      t.status,
      t.priority,
      t.team_members?.name ?? '',
      t.due_date ?? '',
    ],
    cells: [
      t.title,
      t.projects || t.leads || t.clients ? (
        <div key={`context-${t.id}`} className="flex flex-wrap gap-x-2 gap-y-0.5">
          {t.projects ? (
            <Link href={`/projects/${t.projects.id}`} className="hover:underline">
              {t.projects.name}
            </Link>
          ) : null}
          {t.leads ? (
            <Link href={`/leads/${t.leads.id}`} className="hover:underline">
              {t.leads.name}
            </Link>
          ) : null}
          {t.clients ? (
            <Link href={`/clients/${t.clients.id}`} className="hover:underline">
              {t.clients.name}
            </Link>
          ) : null}
        </div>
      ) : (
        <span key={`context-${t.id}`} className="text-muted-foreground">
          Personal
        </span>
      ),
      <StatusBadge key={`s-${t.id}`} meta={TASK_STATUS} value={t.status} />,
      <StatusBadge key={`pr-${t.id}`} meta={TASK_PRIORITY} value={t.priority} />,
      t.team_members?.name ?? '—',
      formatDate(t.due_date),
      <TaskRowActions key={`a-${t.id}`} taskId={t.id} status={t.status} />,
    ],
  }))

  return (
    <ListPage
      title="Tareas"
      description="Organiza el trabajo del equipo y relaciónalo opcionalmente con proyectos, leads o clientes."
      empty={
        q || status || priority || projectId || assigneeId
          ? 'Sin coincidencias.'
          : 'Aún no hay tareas.'
      }
      error={error ?? undefined}
      searchKey="q"
      searchPlaceholder="Buscar por título…"
      filters={[
        { key: 'project', label: 'Proyecto', options: PROJECT_OPTIONS },
        { key: 'status', label: 'Estado', options: STATUS_OPTIONS },
        { key: 'priority', label: 'Prioridad', options: PRIORITY_OPTIONS },
        { key: 'assignee', label: 'Responsable', options: ASSIGNEE_OPTIONS, searchable: true },
      ]}
      pagination={{ page, pageSize: TASK_LIST_PAGE_SIZE, total: count }}
      actions={
        <div className="flex items-center gap-2">
          <TasksViewToggle view={view} />
          <TaskCreateDialog
            projects={projectsList}
            leads={leadsList}
            clients={clientsList}
            members={membersList}
            currentUserId={user.id}
          />
        </div>
      }
      emptyAction={
        <TaskCreateDialog
          projects={projectsList}
          leads={leadsList}
          clients={clientsList}
          members={membersList}
          currentUserId={user.id}
        />
      }
      addHref="/tasks/new"
      addLabel="Nueva tarea"
      headers={[
        { label: 'Título', sortKey: 'title' },
        'Contexto',
        { label: 'Estado', sortKey: 'status' },
        { label: 'Prioridad', sortKey: 'priority' },
        'Asignada',
        { label: 'Vence', sortKey: 'due_date' },
        '',
      ]}
      align={['left', 'left', 'left', 'left', 'left', 'left', 'right']}
      exportFilename="tareas"
      rows={rows}
    />
  )
}
