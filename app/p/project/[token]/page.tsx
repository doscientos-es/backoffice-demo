import {
  CalendarDays,
  Check,
  CircleCheck,
  CircleDot,
  Clock3,
  ExternalLink,
  Globe,
  Inbox,
  MessageSquareText,
  Sparkles,
} from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PortalPasswordGate } from '@/components/portal/password-gate'
import { StatusBadge } from '@/components/ui/status-badge'
import { getCurrentUser } from '@/lib/auth'
import { isPortalUnlocked } from '@/lib/portal/access'
import { PROJECT_STATUS, TASK_STATUS } from '@/lib/status'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'

import { unlockProjectPortal } from './actions'
import { ProjectRequestDialog } from './request-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Seguimiento del proyecto · doscientos',
  robots: { index: false, follow: false },
}

const REQUEST_STATUS: Record<string, { label: string; dot: string }> = {
  new: { label: 'Recibida', dot: 'bg-sky-500' },
  in_progress: { label: 'En curso', dot: 'bg-amber-500' },
  resolved: { label: 'Resuelta', dot: 'bg-emerald-500' },
  closed: { label: 'Cerrada', dot: 'bg-zinc-400' },
}

const REQUEST_CATEGORY: Record<string, string> = {
  question: 'Consulta',
  incident: 'Incidencia',
  change: 'Cambio',
  material: 'Material',
  maintenance: 'Mantenimiento',
  complaint: 'Queja',
}

export default async function ProjectPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()
  const auth = await getCurrentUser()
  const isTeam = auth.ok

  const { data: project } = await admin
    .from('projects')
    .select(
      'id, name, status, starts_at, ends_at, portal_password_hash, is_client_visible, clients(name)',
    )
    .eq('portal_token', token)
    .is('deleted_at', null)
    .maybeSingle()
  if (!project) notFound()

  if (!isTeam) {
    if (project.is_client_visible === false) notFound()
    const unlocked = await isPortalUnlocked(
      token,
      (project.portal_password_hash as string | null) ?? null,
    )
    if (!unlocked) {
      return <PortalPasswordGate token={token} action={unlockProjectPortal} />
    }
  }

  const [{ data: tasks }, { data: requests }, { data: webProjects }] = await Promise.all([
    admin
      .from('tasks')
      .select('id, title, client_title, client_summary, status, due_date, completed_at')
      .eq('project_id', project.id as string)
      .eq('kind', 'task')
      .eq('is_client_visible', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    admin
      .from('project_requests')
      .select('id, subject, category, status, created_at')
      .eq('project_id', project.id as string)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('web_projects')
      .select('id, name, url')
      .eq('project_id', project.id as string)
      .eq('is_client_visible', true)
      .is('deleted_at', null)
      .order('name'),
  ])

  const visibleTasks = (tasks ?? []).filter((task) => task.status !== 'cancelled')
  const completed = visibleTasks.filter((task) => task.status === 'done').length
  const progress =
    visibleTasks.length === 0 ? 0 : Math.round((completed / visibleTasks.length) * 100)
  const client = (project as unknown as { clients: { name: string } | null }).clients
  const hasTasks = visibleTasks.length > 0
  const progressCopy = !hasTasks
    ? 'Estamos preparando los próximos pasos'
    : progress === 100
      ? 'Todo el trabajo compartido está completado'
      : `${completed} de ${visibleTasks.length} tareas completadas`
  const publicWebs = (webProjects ?? []).filter((web) => {
    try {
      return ['http:', 'https:'].includes(new URL(web.url as string).protocol)
    } catch {
      return false
    }
  })

  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-9">
      {isTeam && project.is_client_visible === false ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3.5 text-sm text-amber-950 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100"
        >
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Vista previa interna.</strong> Este portal todavía está oculto para el cliente.
          </p>
        </div>
      ) : null}

      <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-[#172416] px-5 py-7 text-white sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -top-36 -right-24 -z-10 size-80 rounded-full bg-[#bdff7b]/15 blur-3xl transition-transform duration-1000 hover:scale-110"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.035]"
        />

        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-sm font-medium text-[#bdff7b]">
                {client?.name ?? 'Proyecto compartido'}
              </p>
              <span className="size-1 rounded-full bg-white/30" aria-hidden="true" />
              <StatusBadge
                meta={PROJECT_STATUS}
                value={project.status as string}
                className="border border-white/15 bg-white/10 text-white"
              />
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl leading-[1.08] font-semibold text-balance sm:text-4xl lg:text-5xl">
              {project.name as string}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              Consulta el avance del proyecto y envíanos cualquier solicitud desde un único lugar.
            </p>
          </div>

          <div className="border-white/15 lg:border-l lg:py-1 lg:pl-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-white/55">Progreso compartido</p>
                <p className="mt-1 text-sm font-medium text-white/90">{progressCopy}</p>
              </div>
              <strong className="text-3xl font-semibold tracking-tight text-[#bdff7b] tabular-nums">
                {progress}%
              </strong>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/5"
              role="progressbar"
              aria-label="Progreso de las tareas compartidas"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-full bg-[#bdff7b] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="grid border-y border-black/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-black/[0.07] dark:border-white/[0.09] dark:sm:divide-white/[0.09]">
        <InfoItem label="Inicio del proyecto" date={project.starts_at as string | null} />
        <InfoItem label="Entrega prevista" date={project.ends_at as string | null} />
      </section>

      {publicWebs.length > 0 ? (
        <section aria-labelledby="webs-title" className="py-2">
          <div className="flex items-center gap-2.5">
            <Globe className="size-5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            <h2 id="webs-title" className="text-xl font-semibold">
              Webs
            </h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Versiones compartidas de tu proyecto.
          </p>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {publicWebs.map((web) => (
              <li key={web.id as string}>
                <a
                  href={web.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-white hover:shadow-sm motion-reduce:transform-none dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-sky-400/30 dark:hover:bg-white/[0.045]"
                >
                  <span className="truncate text-sm font-medium">{web.name as string}</span>
                  <ExternalLink className="size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-sky-600" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid items-start lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)]">
        <section aria-labelledby="work-title" className="py-2 lg:pr-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <CircleCheck
                className="size-5 text-emerald-700 dark:text-emerald-300"
                aria-hidden="true"
              />
              <h2 id="work-title" className="text-xl font-semibold">
                Estado del trabajo
              </h2>
            </div>
          </div>

          {!hasTasks ? (
            <EmptyState
              icon={<Clock3 className="size-5" aria-hidden="true" />}
              title="Próximos pasos en preparación"
              description="Cuando compartamos tareas contigo, aparecerán aquí con su estado y fecha prevista."
            />
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 dark:divide-white/[0.08]">
              {visibleTasks.map((task) => (
                <li
                  key={task.id as string}
                  className="group flex flex-col gap-3 py-4 transition-colors hover:bg-black/[0.015] sm:flex-row sm:items-center sm:justify-between dark:hover:bg-white/[0.02]"
                >
                  <div className="flex min-w-0 items-start gap-3 sm:items-center">
                    <TaskStateIcon status={task.status as string} />
                    <div className="min-w-0">
                      <span className="block text-sm leading-5 font-medium break-words">
                        {(task.client_title as string | null) ?? (task.title as string)}
                      </span>
                      {task.client_summary ? (
                        <span className="mt-0.5 block text-xs leading-5 break-words text-zinc-600 dark:text-zinc-400">
                          {task.client_summary as string}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 pl-8 sm:justify-end sm:pl-0">
                    {task.due_date ? (
                      <time
                        dateTime={task.due_date as string}
                        className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        {formatDate(task.due_date as string)}
                      </time>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">Sin fecha</span>
                    )}
                    <StatusBadge meta={TASK_STATUS} value={task.status as string} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="requests-title"
          className="mt-7 border-t border-black/[0.07] pt-7 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-2 lg:pl-8 dark:border-white/[0.09]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <MessageSquareText
                className="size-5 text-violet-700 dark:text-violet-300"
                aria-hidden="true"
              />
              <h2 id="requests-title" className="text-xl font-semibold">
                Solicitudes
              </h2>
            </div>
            <ProjectRequestDialog token={token} />
          </div>

          {(requests ?? []).length > 0 ? (
            <ul className="mt-4 max-h-[28rem] divide-y divide-zinc-200 overflow-y-auto pr-1 dark:divide-white/[0.08]">
              {(requests ?? []).map((request) => {
                const status = REQUEST_STATUS[request.status as string]
                return (
                  <li key={request.id as string} className="py-3.5">
                    <p className="text-sm leading-5 font-medium break-words">
                      {request.subject as string}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span className={`size-1.5 rounded-full ${status?.dot ?? 'bg-zinc-400'}`} />
                        {status?.label ?? (request.status as string)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{REQUEST_CATEGORY[request.category as string] ?? 'Solicitud'}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={request.created_at as string}>
                        {formatDate(request.created_at as string)}
                      </time>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={<Inbox className="size-5" aria-hidden="true" />}
              title="Todo al día"
              description="Todavía no has enviado ninguna solicitud para este proyecto."
            />
          )}
        </section>
      </div>
    </div>
  )
}

function TaskStateIcon({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 transition-transform duration-200 group-hover:scale-105 dark:bg-emerald-400/15 dark:text-emerald-300">
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
    )
  }
  if (status === 'in_progress' || status === 'in_review') {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 transition-transform duration-200 group-hover:scale-105 dark:bg-sky-400/15 dark:text-sky-300">
        <CircleDot className="size-3.5" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500 transition-transform duration-200 group-hover:scale-105 dark:bg-white/[0.08] dark:text-zinc-400">
      <CircleDot className="size-3.5" aria-hidden="true" />
    </span>
  )
}

function InfoItem({ label, date }: { label: string; date: string | null }) {
  return (
    <div className="flex items-center gap-3.5 px-1 py-4 sm:px-5 sm:first:pl-1">
      <div className="text-[#2a4227] dark:text-[#bdff7b]">
        <CalendarDays className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        {date ? (
          <time dateTime={date} className="mt-0.5 block text-sm font-semibold">
            {formatDate(date)}
          </time>
        ) : (
          <p className="mt-0.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Por confirmar
          </p>
        )}
      </div>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  compact = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  compact?: boolean
}) {
  return (
    <div className={`mt-5 grid justify-items-center px-5 text-center ${compact ? 'py-6' : 'py-9'}`}>
      <div className="grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-300">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-5 text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  )
}
