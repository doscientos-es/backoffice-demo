import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  SquareCheck as CheckSquare2,
  CircleDollarSign,
  FileText as FileSignature,
  Mail,
  Phone,
  Receipt as ReceiptText,
  Sparkle as Sparkles,
} from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReminderRow } from '@/lib/dashboard/types'
import { groupResendInteractions, interactionDate } from '@/lib/leads/interaction-utils'
import type {
  LeadDetailInteraction,
  LeadRelatedInvoice,
  LeadRelatedProject,
  LeadRelatedProposal,
  LeadRelatedTask,
} from '@/lib/leads/types'
import { formatDate, formatEUR, relativeTime } from '@/lib/utils'

import { EmailDeliveryStatuses } from './email-delivery-statuses'
import { LeadDetailDisclosure } from './lead-detail-disclosure'

type TimelineEvent = {
  id: string
  date: string
  title: string
  detail?: string | null
  emailStatuses?: string[]
  href?: string
  icon: typeof Mail
  color: string
}

function interactionLabel(type: string): string {
  const labels: Record<string, string> = {
    email_sent: 'Email enviado',
    email_received: 'Email recibido',
    email_delivered: 'Email entregado',
    email_opened: 'Email abierto',
    email_clicked: 'Email con clic',
    email_bounced: 'Email rebotado',
    email_complained: 'Email marcado como spam',
    email_scheduled: 'Email programado',
    email_delivery_delayed: 'Entrega de email retrasada',
    email_failed: 'Error al enviar el email',
    email_suppressed: 'Email suprimido',
    call: 'Llamada registrada',
    meeting: 'Reunión registrada',
    note: 'Nota añadida',
    status_change: 'Estado actualizado',
  }
  return labels[type] ?? type.replaceAll('_', ' ')
}

function eventList({
  interactions,
  proposals,
  invoices,
  tasks,
}: {
  interactions: LeadDetailInteraction[]
  proposals: LeadRelatedProposal[]
  invoices: LeadRelatedInvoice[]
  tasks: LeadRelatedTask[]
}): TimelineEvent[] {
  const interactionEvents = groupResendInteractions(interactions).map(
    ({ interaction: item, latestInteraction, statuses }) => ({
      id: `interaction-${item.id}`,
      date: interactionDate(latestInteraction),
      title: item.resend_email_id
        ? statuses.includes('email_received')
          ? 'Email recibido'
          : 'Email enviado'
        : interactionLabel(item.type),
      detail:
        item.subject ??
        item.body
          ?.replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() ??
        null,
      emailStatuses: item.resend_email_id ? statuses : undefined,
      icon: Mail,
      color: 'text-blue-500 bg-blue-500/10',
    }),
  )
  const proposalEvents = proposals.flatMap((item) => {
    const date = item.responded_at ?? item.viewed_at ?? item.sent_at
    if (!date) return []
    return [
      {
        id: `proposal-${item.id}`,
        date,
        title: item.status === 'accepted' ? 'Propuesta aceptada' : 'Propuesta en seguimiento',
        detail: [
          item.number ?? 'Propuesta',
          item.total != null ? formatEUR(Number(item.total)) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        href: `/proposals/${item.id}`,
        icon: FileSignature,
        color: 'text-violet-500 bg-violet-500/10',
      },
    ]
  })
  const invoiceEvents = invoices.map((item) => ({
    id: `invoice-${item.id}`,
    date: item.issue_date ?? new Date().toISOString(),
    title: item.status === 'overdue' ? 'Factura vencida' : 'Factura emitida',
    detail: [
      item.full_number ?? 'Factura',
      item.total != null ? formatEUR(Number(item.total)) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    href: `/invoices/${item.id}`,
    icon: ReceiptText,
    color:
      item.status === 'overdue'
        ? 'text-rose-500 bg-rose-500/10'
        : 'text-emerald-500 bg-emerald-500/10',
  }))
  const taskEvents = tasks.map((item) => ({
    id: `task-${item.id}`,
    date: item.due_date ?? new Date().toISOString(),
    title: item.status === 'done' ? 'Tarea completada' : 'Tarea pendiente',
    detail: item.title,
    href: `/tasks/${item.id}`,
    icon: CheckSquare2,
    color: 'text-amber-500 bg-amber-500/10',
  }))
  return [...interactionEvents, ...proposalEvents, ...invoiceEvents, ...taskEvents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)
}

type NextMove = {
  label: string
  hint: string
  href: string
  cta: string
  icon: typeof Mail
  tone: string
}

function dayKey(value: string) {
  const date = new Date(value)
  return [date.getFullYear(), date.getMonth(), date.getDate()].join('-')
}

function dayLabel(value: string, now = new Date()) {
  const date = new Date(value)
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const elapsedDays = Math.round((currentDay - eventDay) / 86_400_000)
  if (elapsedDays === 0) return 'Hoy'
  if (elapsedDays === 1) return 'Ayer'
  return formatDate(value)
}

function groupEventsByDay(events: TimelineEvent[]) {
  const groups = new Map<string, { label: string; events: TimelineEvent[] }>()
  for (const event of events) {
    const key = dayKey(event.date)
    const current = groups.get(key)
    if (current) current.events.push(event)
    else groups.set(key, { label: dayLabel(event.date), events: [event] })
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }))
}

function isActiveLeadStatus(status: string) {
  return !['won', 'lost', 'not_interested', 'archived'].includes(status)
}

function leadFeedbackHref(leadId: string, feedback: 'call' | 'schedule') {
  return `/leads/${leadId}?feedback=${feedback}`
}

function nextMove({
  leadId,
  leadStatus,
  firstContactedAt,
  phone,
  reminders,
  interactions,
  proposals,
  projects,
  invoices,
}: {
  leadId: string
  leadStatus: string
  firstContactedAt?: string | null
  phone?: string | null
  reminders?: ReminderRow[]
  interactions?: LeadDetailInteraction[]
  proposals: LeadRelatedProposal[]
  projects: LeadRelatedProject[]
  invoices: LeadRelatedInvoice[]
}): NextMove {
  const now = new Date()
  const scheduledReminders = reminders ?? []
  const overdueReminder = scheduledReminders.find(
    (reminder) => new Date(reminder.remind_at).getTime() < now.getTime(),
  )
  const hasFutureReminder = scheduledReminders.some(
    (reminder) => new Date(reminder.remind_at).getTime() >= now.getTime(),
  )
  const latestInteraction = interactions
    ?.map(interactionDate)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
  const contactHref = leadFeedbackHref(leadId, phone ? 'call' : 'schedule')
  const contactCta = phone ? 'Registrar llamada' : 'Agendar contacto'
  const overdueInvoice = invoices.find((item) => item.status === 'overdue')
  if (overdueInvoice) {
    return {
      label: 'Reclamar el cobro pendiente',
      hint: `La factura ${overdueInvoice.full_number ?? 'vencida'} necesita seguimiento.`,
      href: `/invoices/${overdueInvoice.id}`,
      cta: 'Abrir factura',
      icon: ReceiptText,
      tone: 'border-rose-500/20 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300',
    }
  }

  if (overdueReminder && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Resolver seguimiento vencido',
      hint: `“${overdueReminder.title}” venció ${relativeTime(overdueReminder.remind_at)}.`,
      href: contactHref,
      cta: contactCta,
      icon: CalendarClock,
      tone: 'border-rose-500/20 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300',
    }
  }

  if (!firstContactedAt && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Registrar el primer contacto',
      hint: 'Este lead todavía no tiene actividad comercial registrada.',
      href: contactHref,
      cta: contactCta,
      icon: Phone,
      tone: 'border-primary/20 bg-primary/[0.06] text-primary',
    }
  }

  const draftProposal = proposals.find((item) => item.status === 'draft')
  if (draftProposal) {
    return {
      label: 'Completar y enviar la propuesta',
      hint: `${draftProposal.number ?? draftProposal.title ?? 'La propuesta'} está en borrador.`,
      href: `/proposals/${draftProposal.id}`,
      cta: 'Abrir propuesta',
      icon: FileSignature,
      tone: 'border-violet-500/20 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300',
    }
  }

  const openProposal = proposals.find((item) => ['sent', 'viewed'].includes(item.status ?? ''))
  if (openProposal) {
    return {
      label: 'Hacer seguimiento de la propuesta',
      hint: `${openProposal.number ?? 'La propuesta'} está en circulación.`,
      href: `/proposals/${openProposal.id}`,
      cta: 'Abrir propuesta',
      icon: FileSignature,
      tone: 'border-violet-500/20 bg-violet-500/[0.06] text-violet-700 dark:text-violet-300',
    }
  }

  const activeProject = projects.find((item) => item.status === 'active')
  if (activeProject) {
    return {
      label: 'Mantener al cliente al día',
      hint: `${activeProject.name} está en ejecución.`,
      href: `/projects/${activeProject.id}`,
      cta: 'Abrir proyecto',
      icon: BriefcaseBusiness,
      tone: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
    }
  }

  const acceptedProposal = proposals.find((item) => item.status === 'accepted')
  if (acceptedProposal) {
    return {
      label: 'Preparar la entrega acordada',
      hint: `${acceptedProposal.number ?? acceptedProposal.title ?? 'La propuesta'} ya está aceptada.`,
      href: `/proposals/${acceptedProposal.id}`,
      cta: 'Abrir propuesta',
      icon: FileSignature,
      tone: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300',
    }
  }

  if (latestInteraction && !hasFutureReminder && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Retomar la conversación',
      hint: `La última señal fue ${relativeTime(latestInteraction)} y no hay un seguimiento programado.`,
      href: contactHref,
      cta: contactCta,
      icon: Phone,
      tone: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300',
    }
  }

  if (!hasFutureReminder && isActiveLeadStatus(leadStatus)) {
    return {
      label: 'Planificar el siguiente paso',
      hint: 'No hay ningún seguimiento programado para mantener viva la oportunidad.',
      href: leadFeedbackHref(leadId, 'schedule'),
      cta: 'Agendar seguimiento',
      icon: CalendarClock,
      tone: 'border-primary/20 bg-primary/[0.06] text-primary',
    }
  }

  return {
    label: 'Crear la siguiente oportunidad',
    hint: 'El flujo no tiene una transición abierta todavía.',
    href: proposals.length ? `/proposals/new?lead_id=${leadId}` : `/leads/${leadId}`,
    cta: proposals.length ? 'Crear propuesta' : 'Ver lead',
    icon: CircleDollarSign,
    tone: 'border-primary/20 bg-primary/[0.06] text-primary',
  }
}

export function Lead360Timeline({
  leadId,
  leadStatus,
  firstContactedAt,
  phone,
  reminders = [],
  interactions,
  proposals,
  projects,
  invoices,
  tasks,
}: {
  leadId: string
  leadStatus: string
  firstContactedAt?: string | null
  phone?: string | null
  reminders?: ReminderRow[]
  interactions: LeadDetailInteraction[]
  proposals: LeadRelatedProposal[]
  projects: LeadRelatedProject[]
  invoices: LeadRelatedInvoice[]
  tasks: LeadRelatedTask[]
}) {
  const events = eventList({ interactions, proposals, invoices, tasks })
  const eventGroups = groupEventsByDay(events)
  const next = nextMove({
    leadId,
    leadStatus,
    firstContactedAt,
    phone,
    reminders,
    interactions,
    proposals,
    projects,
    invoices,
  })
  const NextIcon = next.icon

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <LeadDetailDisclosure
        id="journey-360"
        title="Journey 360º"
        titleIcon={<Sparkles className="text-primary size-4" />}
        description="Todo lo que ha pasado alrededor de esta oportunidad."
        headerAside={
          <div className="text-muted-foreground shrink-0 text-right text-xs tabular-nums">
            <p>{events.length} señales</p>
            {events[0] ? <p>Última {relativeTime(events[0].date)}</p> : null}
          </div>
        }
        contentClassName="px-5 py-5"
      >
        {events.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">
            Aún no hay actividad cruzada registrada.
          </p>
        ) : (
          <div className="space-y-5">
            {eventGroups.map((group) => (
              <section key={group.key} aria-label={`Actividad: ${group.label}`}>
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </p>
                <ol className="border-border relative ml-2 border-l">
                  {group.events.map((event) => {
                    const Icon = event.icon
                    const content = (
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize">{event.title}</p>
                          {event.detail ? (
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {event.detail}
                            </p>
                          ) : null}
                          {event.emailStatuses ? (
                            <EmailDeliveryStatuses statuses={event.emailStatuses} />
                          ) : null}
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {relativeTime(event.date)}
                        </span>
                      </div>
                    )
                    return (
                      <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                        <span
                          className={`ring-card -ml-3.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ${event.color}`}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        {event.href ? (
                          <Link href={event.href} className="min-w-0 flex-1 hover:opacity-75">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </LeadDetailDisclosure>

      <Card className={`border ${next.tone}`}>
        <CardHeader>
          <CardTitle className="text-base">Siguiente movimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-background/70 flex size-10 items-center justify-center rounded-xl shadow-sm">
            <NextIcon className="size-5" />
          </div>
          <h3 className="mt-4 text-base leading-snug font-semibold">{next.label}</h3>
          <p className="mt-2 text-sm opacity-80">{next.hint}</p>
          <Link
            href={next.href}
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium hover:underline"
          >
            {next.cta} <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
