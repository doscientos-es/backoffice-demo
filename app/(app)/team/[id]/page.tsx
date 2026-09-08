import {
  BriefcaseBusiness,
  CheckSquare,
  Clock as Clock3,
  GitBranch as Github,
  ListTodo,
  Mail,
  MessageSquare,
  Phone,
  TriangleAlert,
  Users,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/layout/stat-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { type MemberRole, requireUser } from '@/lib/auth'
import { ACTIVE_LEAD_STATUSES } from '@/lib/leads/pipeline'
import { LEAD_STATUS, PROJECT_STATUS, TASK_STATUS } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, memberAvatarUrl, relativeTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Detalle del miembro · doscientos' }
export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Solo lectura',
}

const ROLE_VARIANT: Record<MemberRole, 'default' | 'info' | 'neutral'> = {
  owner: 'default',
  admin: 'info',
  member: 'neutral',
  viewer: 'neutral',
}

type Member = {
  id: string
  name: string
  email: string
  role: MemberRole
  created_at: string
  deleted_at: string | null
  avatar_url: string | null
  github_handle: string | null
  job_title: string | null
  phone: string | null
  contact_email: string | null
  email_alias: string | null
  leads_assignable: boolean
}

type ProjectRef = {
  id: string
  name: string
  status: string | null
  client_name: string | null
}

type TaskRow = {
  id: string
  title: string
  status: string | null
  due_date: string | null
  project_id: string | null
  projects: { id: string; name: string; status: string | null } | null
}

type WorkLogRow = {
  id: string
  work_date: string
  hours: number | string
  note: string | null
  project_id: string
  projects: { id: string; name: string; status: string | null } | null
}

type LeadInteractionRow = {
  id: string
  type: string
  subject: string | null
  created_at: string
  leads: { id: string; name: string } | null
}

type TaskCommentRow = {
  id: string
  created_at: string
  tasks: { id: string; title: string } | null
}

type MemberActivity = {
  id: string
  kind: 'interaction' | 'comment' | 'work_log'
  title: string
  detail: string
  created_at: string
  href: string | null
}

const INTERACTION_LABELS: Record<string, string> = {
  call: 'Registró una llamada',
  email_sent: 'Envió un email',
  meeting: 'Registró una reunión',
  note: 'Añadió una nota',
  owner_change: 'Cambió el responsable',
  status_change: 'Cambió el estado',
}

const ACTIVITY_ICONS = {
  interaction: MessageSquare,
  comment: ListTodo,
  work_log: Clock3,
} as const

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function hoursLabel(hours: number): string {
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(hours)} h`
}

function mapProject(row: {
  id: unknown
  name: unknown
  status: unknown
  clients: { name: string } | null
}): ProjectRef {
  return {
    id: row.id as string,
    name: row.name as string,
    status: (row.status as string | null) ?? null,
    client_name: row.clients?.name ?? null,
  }
}

function EmptySection({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()
  const { id } = await params
  const supabase = await createServerClient()

  const [
    { data: memberData },
    { data: leadsData },
    { count: leadCount },
    { data: directTasksData },
    { data: taskMembersData },
    { data: workLogsData },
    { data: proposalMembersData },
    { data: interactionsData },
    { data: taskCommentsData },
    { count: staleLeadCount },
  ] = await Promise.all([
    supabase
      .from('team_members')
      .select(
        'id, name, email, role, created_at, deleted_at, avatar_url, github_handle, job_title, phone, contact_email, email_alias, leads_assignable',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('leads')
      .select('id, name, company, status, estimated_value, updated_at, created_at')
      .eq('assigned_to', id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(12),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', id)
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .select('id, title, status, due_date, project_id, projects(id, name, status)')
      .eq('assignee_id', id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase.from('task_members').select('task_id').eq('member_id', id),
    supabase
      .from('work_logs')
      .select('id, work_date, hours, note, project_id, projects(id, name, status)')
      .eq('member_id', id)
      .is('deleted_at', null)
      .order('work_date', { ascending: false }),
    supabase.from('proposal_team_members').select('proposal_id').eq('member_id', id),
    supabase
      .from('lead_interactions')
      .select('id, type, subject, created_at, leads(id, name)')
      .eq('performed_by', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('task_comments')
      .select('id, created_at, tasks(id, title)')
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', id)
      .in('status', ACTIVE_LEAD_STATUSES as unknown as string[])
      .lt('updated_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .is('deleted_at', null),
  ])

  if (!memberData) notFound()

  const member = memberData as unknown as Member
  const directTasks = (directTasksData ?? []) as unknown as TaskRow[]
  const directTaskIds = new Set(directTasks.map((task) => task.id))
  const collaboratorTaskIds = (taskMembersData ?? [])
    .map((row) => row.task_id as string)
    .filter((taskId) => !directTaskIds.has(taskId))

  const { data: collaboratorTasksData } = collaboratorTaskIds.length
    ? await supabase
        .from('tasks')
        .select('id, title, status, due_date, project_id, projects(id, name, status)')
        .in('id', collaboratorTaskIds)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
    : { data: [] }

  const tasks = [...directTasks, ...((collaboratorTasksData ?? []) as unknown as TaskRow[])]
  const workLogs = (workLogsData ?? []) as unknown as WorkLogRow[]
  const interactions = (interactionsData ?? []) as unknown as LeadInteractionRow[]
  const taskComments = (taskCommentsData ?? []) as unknown as TaskCommentRow[]
  const proposalIds = (proposalMembersData ?? []).map((row) => row.proposal_id as string)

  const { data: proposalRowsData } = proposalIds.length
    ? await supabase
        .from('proposals')
        .select('project_id')
        .in('id', proposalIds)
        .is('deleted_at', null)
    : { data: [] }

  const projectIds = [
    ...new Set(
      [
        ...tasks.map((task) => task.project_id),
        ...workLogs.map((log) => log.project_id),
        ...(proposalRowsData ?? []).map((row) => row.project_id as string | null),
      ].filter((projectId): projectId is string => Boolean(projectId)),
    ),
  ]

  const { data: projectData } = projectIds.length
    ? await supabase
        .from('projects')
        .select('id, name, status, clients(name)')
        .in('id', projectIds)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
    : { data: [] }

  const projects = (projectData ?? []).map((row) =>
    mapProject(row as unknown as Parameters<typeof mapProject>[0]),
  )
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const totalHours = workLogs.reduce((total, log) => {
    const hours = typeof log.hours === 'string' ? Number.parseFloat(log.hours) : log.hours
    return total + (Number.isFinite(hours) ? hours : 0)
  }, 0)
  const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled')
  const today = new Date().toISOString().slice(0, 10)
  const overdueTasks = openTasks.filter((task) => task.due_date && task.due_date < today).length
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  const weekStartDate = weekStart.toISOString().slice(0, 10)
  const weeklyHours = workLogs.reduce((total, log) => {
    if (log.work_date < weekStartDate) return total
    const hours = typeof log.hours === 'string' ? Number.parseFloat(log.hours) : log.hours
    return total + (Number.isFinite(hours) ? hours : 0)
  }, 0)
  const avatarUrl = memberAvatarUrl({
    avatarUrl: member.avatar_url,
    githubHandle: member.github_handle,
  })
  const recentActivity: MemberActivity[] = [
    ...interactions.map((interaction) => ({
      id: `interaction-${interaction.id}`,
      kind: 'interaction' as const,
      title: INTERACTION_LABELS[interaction.type] ?? 'Registró una interacción',
      detail: interaction.subject ?? interaction.leads?.name ?? 'Lead',
      created_at: interaction.created_at,
      href: interaction.leads ? `/leads/${interaction.leads.id}` : null,
    })),
    ...taskComments.map((comment) => ({
      id: `comment-${comment.id}`,
      kind: 'comment' as const,
      title: 'Comentó una tarea',
      detail: comment.tasks?.title ?? 'Tarea',
      created_at: comment.created_at,
      href: comment.tasks ? `/tasks/${comment.tasks.id}` : null,
    })),
    ...workLogs.map((log) => ({
      id: `work-log-${log.id}`,
      kind: 'work_log' as const,
      title: `Registró ${hoursLabel(Number(log.hours) || 0)}`,
      detail: projectById.get(log.project_id)?.name ?? log.projects?.name ?? 'Proyecto',
      created_at: log.work_date,
      href: log.project_id ? `/projects/${log.project_id}` : null,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={member.name}
        description={member.job_title ?? member.email}
        back={<BackLink href="/settings/team" label="Volver al equipo" />}
        icon={
          <Avatar size="lg">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={member.name} referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback>{initials(member.name)}</AvatarFallback>
          </Avatar>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Leads asignados"
          value={leadCount ?? leadsData?.length ?? 0}
          icon={Users}
          tone="info"
          href={`/leads?view=list&assignee=${member.id}`}
        />
        <StatCard
          label="Proyectos"
          value={projects.length}
          icon={BriefcaseBusiness}
          tone="success"
        />
        <StatCard
          label="Tareas abiertas"
          value={openTasks.length}
          icon={CheckSquare}
          tone={overdueTasks > 0 ? 'warning' : 'default'}
          hint={
            overdueTasks > 0 ? `${overdueTasks} vencida${overdueTasks === 1 ? '' : 's'}` : undefined
          }
          href={`/tasks?view=list&assignee=${member.id}`}
        />
        <StatCard label="Horas esta semana" value={hoursLabel(weeklyHours)} icon={Clock3} />
      </div>

      <Card className="border-amber-500/20 bg-amber-500/3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
            Requiere atención
          </CardTitle>
          <CardDescription>
            Señales que conviene revisar antes de que bloqueen el trabajo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {overdueTasks > 0 ? (
            <Link
              href={`/tasks?view=list&assignee=${member.id}`}
              className="bg-background hover:bg-muted rounded-md px-3 py-2 text-sm font-medium shadow-xs transition-colors"
            >
              {overdueTasks} tarea{overdueTasks === 1 ? '' : 's'} vencida
              {overdueTasks === 1 ? '' : 's'}
            </Link>
          ) : null}
          {(staleLeadCount ?? 0) > 0 ? (
            <Link
              href={`/leads?view=list&assignee=${member.id}&attention=stale`}
              className="bg-background hover:bg-muted rounded-md px-3 py-2 text-sm font-medium shadow-xs transition-colors"
            >
              {staleLeadCount} lead{staleLeadCount === 1 ? '' : 's'} estancado
              {staleLeadCount === 1 ? '' : 's'}
            </Link>
          ) : null}
          {overdueTasks === 0 && (staleLeadCount ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin bloqueos detectados en tareas o leads.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Información y acceso de este miembro.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Rol">
                <Badge variant={ROLE_VARIANT[member.role]}>{ROLE_LABELS[member.role]}</Badge>
              </DetailRow>
              <DetailRow label="Incorporación">
                <span title={member.created_at}>{formatDate(member.created_at)}</span>
              </DetailRow>
              <DetailRow label="Antigüedad">{relativeTime(member.created_at)}</DetailRow>
              <DetailRow label="Estado">
                {member.deleted_at ? (
                  <Badge variant="danger">Desactivado</Badge>
                ) : (
                  <Badge variant="success">Activo</Badge>
                )}
              </DetailRow>
              <DetailRow label="Leads automáticos">
                {member.leads_assignable ? 'Sí' : 'No'}
              </DetailRow>
              <DetailRow label="Email">
                <a
                  className="hover:text-primary inline-flex items-center gap-1"
                  href={`mailto:${member.email}`}
                >
                  <Mail className="size-3.5" />
                  {member.email}
                </a>
              </DetailRow>
              {member.phone ? (
                <DetailRow label="Teléfono">
                  <a
                    className="hover:text-primary inline-flex items-center gap-1"
                    href={`tel:${member.phone}`}
                  >
                    <Phone className="size-3.5" />
                    {member.phone}
                  </a>
                </DetailRow>
              ) : null}
              {member.github_handle ? (
                <DetailRow label="GitHub">
                  <a
                    className="hover:text-primary inline-flex items-center gap-1"
                    href={`https://github.com/${member.github_handle}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github className="size-3.5" />
                    {member.github_handle}
                  </a>
                </DetailRow>
              ) : null}
            </DetailGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proyectos</CardTitle>
            <CardDescription>
              Proyectos relacionados con sus tareas, horas y propuestas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptySection
                title="Sin proyectos todavía"
                description="Aún no hay actividad de este miembro en proyectos."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="border-border/70 hover:border-primary/40 hover:bg-muted/50 rounded-lg border p-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium">{project.name}</span>
                      <StatusBadge meta={PROJECT_STATUS} value={project.status} />
                    </div>
                    {project.client_name ? (
                      <span className="text-muted-foreground mt-1 block truncate text-xs">
                        {project.client_name}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
          <CardDescription>
            Últimas acciones registradas en leads, tareas y partes de horas.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {recentActivity.length === 0 ? (
            <EmptySection
              title="Sin actividad registrada"
              description="Todavía no hay acciones registradas para este miembro."
            />
          ) : (
            <ol className="divide-border divide-y">
              {recentActivity.map((activity) => {
                const ActivityIcon = ACTIVITY_ICONS[activity.kind]
                const content = (
                  <>
                    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                      <ActivityIcon className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{activity.title}</p>
                      <p className="text-muted-foreground truncate text-xs">{activity.detail}</p>
                    </div>
                    <time
                      dateTime={activity.created_at}
                      title={formatDate(activity.created_at)}
                      className="text-muted-foreground shrink-0 text-xs"
                    >
                      {relativeTime(activity.created_at)}
                    </time>
                  </>
                )
                return (
                  <li key={activity.id}>
                    {activity.href ? (
                      <Link
                        href={activity.href}
                        className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">{content}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Leads asignados</CardTitle>
              <Link
                href={`/leads?view=list&assignee=${member.id}`}
                className="text-primary text-xs font-medium hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <CardDescription>
              {leadCount ?? leadsData?.length ?? 0} {leadCount === 1 ? 'lead' : 'leads'} en total.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {(leadsData ?? []).length === 0 ? (
              <EmptySection
                title="Sin leads asignados"
                description="Este miembro todavía no tiene leads a su cargo."
              />
            ) : (
              <div className="divide-border divide-y">
                {(leadsData ?? []).map((lead) => (
                  <Link
                    key={lead.id as string}
                    href={`/leads/${lead.id}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{lead.name as string}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {(lead.company as string | null) ?? 'Sin empresa'}
                      </p>
                    </div>
                    <StatusBadge meta={LEAD_STATUS} value={lead.status as string} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Tareas</CardTitle>
              <Link
                href={`/tasks?view=list&assignee=${member.id}`}
                className="text-primary text-xs font-medium hover:underline"
              >
                Ver asignadas
              </Link>
            </div>
            <CardDescription>Asignadas directamente o como colaborador.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {tasks.length === 0 ? (
              <EmptySection
                title="Sin tareas"
                description="Este miembro todavía no tiene tareas asignadas."
              />
            ) : (
              <div className="divide-border divide-y">
                {tasks.slice(0, 12).map((task) => {
                  const project = task.project_id ? projectById.get(task.project_id) : task.projects
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{task.title}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {project?.name ?? 'Sin proyecto'}
                          {task.due_date ? ` · ${formatDate(task.due_date)}` : ''}
                        </p>
                      </div>
                      <StatusBadge meta={TASK_STATUS} value={task.status} />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas horas registradas</CardTitle>
          <CardDescription>{hoursLabel(totalHours)} acumuladas en partes de horas.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {workLogs.length === 0 ? (
            <EmptySection
              title="Sin horas registradas"
              description="Todavía no hay partes de horas de este miembro."
            />
          ) : (
            <div className="divide-border divide-y">
              {workLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {projectById.get(log.project_id)?.name ?? log.projects?.name ?? 'Proyecto'}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {formatDate(log.work_date)}
                      {log.note ? ` · ${log.note}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {hoursLabel(Number(log.hours) || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
