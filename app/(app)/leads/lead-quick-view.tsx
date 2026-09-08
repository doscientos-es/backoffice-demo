'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@doscientos/ui'
import {
  ArrowUpRight,
  Building2,
  CalendarPlus,
  ChevronDown,
  Clock,
  Hand,
  LoaderCircle as Loader2,
  Mail,
  Phone,
  Timer,
  Trash as Trash2,
  TriangleAlert,
  CircleUser as UserRound,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { MemberLabel } from '@/components/ui/member-avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { requiresCyaProspectSoftwareCommission } from '@/lib/leads/attribution'
import { nextActionState } from '@/lib/leads/pipeline'
import { leadDisplayName } from '@/lib/leads/utils'
import type { MemberOption } from '@/lib/members/queries'
import { LEAD_STATUS } from '@/lib/status'
import { formatEUR, relativeTime } from '@/lib/utils'

import { ScheduleReminderDialog } from '../reminders/schedule-reminder-dialog'
import { createTask } from '../tasks/actions'
import { ExtractTasksDialog } from './[id]/extract-tasks-dialog'
import { GmailSyncButton } from './[id]/gmail-sync-button'
import { LeadEditDialog } from './[id]/lead-edit-dialog'
import { LeadCallLink } from './[id]/phone-actions'
import { assignLeadOwner, claimLead } from './actions'
import {
  QCallDialog,
  QEmailDialog,
  QMeetDialog,
  QMeetNowDialog,
  QNoteDialog,
  QSendEmailDialog,
  QWhatsAppDialog,
} from './lead-quick-action-dialogs'
import type { KanbanLead } from './leads-kanban'

const INTERACTION_LABEL: Record<string, string> = {
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
  call: 'Llamada',
  meeting: 'Reunión',
  note: 'Nota',
  owner_change: 'Responsable cambiado',
  status_change: 'Cambio de estado',
}

export function LeadQuickView({
  lead,
  canEdit = false,
  aiEnabled = false,
  googleEnabled = false,
  members = [],
  senderName = '',
  onDeleteAction,
  onCloseAction,
}: {
  lead: KanbanLead | null
  canEdit?: boolean
  aiEnabled?: boolean
  googleEnabled?: boolean
  members?: MemberOption[]
  senderName?: string
  /** Optimistically removes the lead from the board and runs the delete. Optional — falls back to router.refresh(). */
  onDeleteAction?: (id: string) => void
  onCloseAction: () => void
}) {
  return (
    <DrawerContent
      isOpen={!!lead}
      onOpenChange={(open) => !open && onCloseAction()}
      side="right"
      className="sm:max-w-sm"
      showCloseButton={false}
    >
      {lead ? (
        <ErrorBoundary>
          <Body
            lead={lead}
            canEdit={canEdit}
            aiEnabled={aiEnabled}
            googleEnabled={googleEnabled}
            members={members}
            senderName={senderName}
            onDeleteAction={onDeleteAction}
          />
        </ErrorBoundary>
      ) : null}
    </DrawerContent>
  )
}

function Body({
  lead,
  canEdit,
  aiEnabled,
  googleEnabled,
  members,
  senderName,
  onDeleteAction,
}: {
  lead: KanbanLead
  canEdit: boolean
  aiEnabled: boolean
  googleEnabled: boolean
  members: MemberOption[]
  senderName: string
  onDeleteAction?: (id: string) => void
}) {
  const hasEstimated = lead.estimated_value != null && lead.estimated_value > 0
  const displayName = leadDisplayName(lead)
  const alias = lead.alias?.trim()
  const campaignName = lead.marketing_campaign_name
  const needsNextAction = nextActionState(lead.status, lead.next_action) === 'missing'
  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto_auto]">
      <DrawerHeader className="border-border flex flex-row items-start justify-between gap-2 border-b">
        <div className="flex flex-col gap-1">
          <DrawerTitle>{displayName}</DrawerTitle>
          {alias && alias !== lead.name ? (
            <span className="text-muted-foreground text-xs">Nombre: {lead.name}</span>
          ) : null}
          <DrawerDescription className="flex items-center gap-1.5">
            <StatusBadge meta={LEAD_STATUS} value={lead.status} />
            <span className="text-[11px] tabular-nums">{relativeTime(lead.updated_at)}</span>
          </DrawerDescription>
        </div>
        <DrawerClose variant="ghost" size="icon-sm" aria-label="Cerrar">
          <X className="size-4" />
        </DrawerClose>
      </DrawerHeader>

      <div className="scroll-fade no-scrollbar flex h-full flex-1 flex-col gap-4 overflow-y-auto p-4">
        {canEdit && needsNextAction ? (
          <section className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <CalendarPlus className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">Sin próxima acción</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Agenda el siguiente contacto antes de cerrar este lead.
                </p>
                <ScheduleReminderDialog
                  leadId={lead.id}
                  defaultTitle={`Seguimiento de ${displayName}`}
                  trigger={
                    <Button type="button" size="sm" className="mt-3 w-full">
                      Agendar seguimiento
                    </Button>
                  }
                />
              </div>
            </div>
          </section>
        ) : null}
        {(lead.status === 'lost' || lead.status === 'not_interested') && lead.lost_reason && (
          <div className="border-destructive/30 bg-destructive/8 flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs">
            <TriangleAlert className="text-destructive mt-0.5 size-3.5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-destructive font-semibold">
                {lead.status === 'lost' ? 'Motivo de pérdida' : 'Motivo de no interés'}
              </span>
              <span className="text-foreground">{lead.lost_reason}</span>
            </div>
          </div>
        )}
        <section className="flex flex-col gap-1.5 text-xs">
          {lead.company && <Row icon={<Building2 className="size-3.5" />}>{lead.company}</Row>}
          {lead.email && (
            <Row icon={<Mail className="size-3.5" />} href={`mailto:${lead.email}`}>
              {lead.email}
            </Row>
          )}
          {lead.phone && (
            <div className="hover:text-primary flex items-center gap-2">
              <span className="text-muted-foreground">
                <Phone className="size-3.5" />
              </span>
              <LeadCallLink leadId={lead.id} phone={lead.phone} className="truncate">
                {lead.phone}
              </LeadCallLink>
            </div>
          )}
          {hasEstimated && (
            <Row icon={<Wallet className="size-3.5" />}>
              <span className="tabular-nums">{formatEUR(lead.estimated_value as number)}</span>
            </Row>
          )}
          {lead.score != null && (
            <Row icon={<Timer className="size-3.5" />}>
              <span className="tabular-nums">Score {lead.score}/100</span>
            </Row>
          )}
          <Row icon={<UserRound className="size-3.5" />}>
            {canEdit && !lead.assignee ? (
              <AssignWidget leadId={lead.id} members={members} />
            ) : (
              <MemberLabel member={lead.assignee} size="sm" />
            )}
          </Row>
          <Row icon={<Timer className="size-3.5" />}>
            {lead.first_contacted_at ? (
              <span className="tabular-nums">
                Primer contacto {relativeTime(lead.first_contacted_at)}
              </span>
            ) : (
              <span className="text-muted-foreground">Sin contactar</span>
            )}
          </Row>
        </section>
        {(lead.company_size || lead.solution_type || lead.urgency) && (
          <section className="flex flex-col gap-1.5 text-xs">
            <Heading>Cualificación</Heading>
            {lead.company_size && (
              <Row icon={<Users className="size-3.5" />}>{lead.company_size}</Row>
            )}
            {lead.solution_type && (
              <Row icon={<Wrench className="size-3.5" />}>{lead.solution_type}</Row>
            )}
            {lead.urgency && <Row icon={<Clock className="size-3.5" />}>{lead.urgency}</Row>}
          </section>
        )}
        {(lead.source ||
          lead.landing_path ||
          lead.landing_ref ||
          lead.landing_subject ||
          lead.conversion_step ||
          lead.first_landing_path ||
          lead.last_utm_source ||
          lead.last_utm_campaign ||
          campaignName) && (
          <section className="flex flex-col gap-1.5 text-xs">
            <Heading>Atribución</Heading>
            {(lead.last_utm_source || lead.source) && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>
                Fuente: {lead.last_utm_source || lead.source}
              </Row>
            )}
            {campaignName && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>Campaña: {campaignName}</Row>
            )}
            {requiresCyaProspectSoftwareCommission(campaignName) && (
              <Row icon={<TriangleAlert className="size-3.5" />}>
                Comisión CYA: 20 % de lo ganado
              </Row>
            )}
            {(lead.first_landing_path || lead.landing_path) && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>
                Entrada: {lead.first_landing_path || lead.landing_path}
              </Row>
            )}
            {lead.conversion_step && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>{lead.conversion_step}</Row>
            )}
            {lead.landing_ref && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>{lead.landing_ref}</Row>
            )}
            {lead.landing_subject && (
              <Row icon={<ArrowUpRight className="size-3.5" />}>{lead.landing_subject}</Row>
            )}
          </section>
        )}
        {lead.notes && (
          <section className="flex flex-col gap-1.5">
            <Heading>Notas</Heading>
            <p className="text-foreground text-xs leading-relaxed whitespace-pre-wrap">
              {lead.notes}
            </p>
          </section>
        )}
        {lead.ai_summary && (
          <section className="flex flex-col gap-1.5">
            <Heading>Resumen IA</Heading>
            <p className="text-foreground text-xs leading-relaxed">{lead.ai_summary}</p>
          </section>
        )}
        <Interactions interactions={lead.recent_interactions} />
      </div>

      <div className="border-border shrink-0 border-t px-4 py-3">
        <DrawerQuickActions
          leadId={lead.id}
          leadName={displayName}
          leadPhone={lead.phone}
          leadEmail={lead.email}
          senderName={senderName}
          aiEnabled={aiEnabled}
          googleEnabled={googleEnabled}
        />
      </div>

      <footer className="border-border flex items-center gap-2 border-t p-3">
        {canEdit && (
          <>
            {onDeleteAction && (
              <DeleteLeadButton
                leadId={lead.id}
                leadName={displayName}
                onConfirmAction={onDeleteAction}
              />
            )}
            <LeadEditDialog
              members={members}
              lead={{
                id: lead.id,
                name: lead.name,
                alias: lead.alias,
                company: lead.company,
                email: lead.email,
                phone: lead.phone,
                source: lead.source,
                notes: lead.notes,
                estimated_value: lead.estimated_value,
                company_size: lead.company_size ?? null,
                solution_type: lead.solution_type ?? null,
                urgency: lead.urgency ?? null,
                assigned_to: lead.assignee?.id ?? null,
                version: lead.version,
              }}
            />
          </>
        )}
        <Button asChild className="flex-1" size="sm" variant="outline">
          <Link href={`/leads/${lead.id}`}>
            Ver detalle completo
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </footer>
    </div>
  )
}

function DeleteLeadButton({
  leadId,
  leadName,
  onConfirmAction,
}: {
  leadId: string
  leadName: string
  /** Triggers the optimistic removal + delete in the parent board. */
  onConfirmAction: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  function onConfirm() {
    setOpen(false)
    onConfirmAction(leadId)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar lead"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar lead</DialogTitle>
          <DialogDescription>
            ¿Eliminar <strong>{leadName}</strong>? Esta acción es reversible desde la base de datos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
      {children}
    </p>
  )
}

function Row({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  const inner = (
    <>
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{children}</span>
    </>
  )
  return href ? (
    <a href={href} className="hover:text-primary flex items-center gap-2">
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-2">{inner}</div>
  )
}

function Interactions({ interactions }: { interactions: KanbanLead['recent_interactions'] }) {
  return (
    <section className="flex flex-col gap-1.5">
      <Heading>Últimas interacciones</Heading>
      {interactions.length === 0 ? (
        <p className="text-muted-foreground/80 text-xs">Sin interacciones registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {interactions.slice(0, 3).map((i) => (
            <li key={i.id} className="bg-muted/30 flex flex-col gap-0.5 rounded-md p-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-foreground font-medium">
                  {INTERACTION_LABEL[i.type] ?? i.type}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {relativeTime(i.created_at)}
                </span>
              </div>
              {i.subject && (
                <p className="text-muted-foreground line-clamp-2 text-[11px]">{i.subject}</p>
              )}
              {i.performer && (
                <MemberLabel
                  member={i.performer}
                  size="sm"
                  className="text-muted-foreground text-[11px]"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Assign Widget ───────────────────────────────────────────────────────────

function AssignWidget({ leadId, members }: { leadId: string; members: MemberOption[] }) {
  const router = useRouter()
  const [claimPending, startClaim] = useTransition()
  const [assignPending, startAssign] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isPending = claimPending || assignPending

  const handleClaim = () => {
    setError(null)
    startClaim(async () => {
      const res = await claimLead({ leadId })
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  const handleAssign = (assigneeId: string) => {
    if (!assigneeId) return
    setError(null)
    startAssign(async () => {
      const res = await assignLeadOwner({ leadId, assigneeId })
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={isPending}
        onClick={handleClaim}
        className="w-full justify-start gap-1.5"
      >
        {claimPending ? <Loader2 className="size-3 animate-spin" /> : <Hand className="size-3" />}
        Asignármelo
      </Button>
      <select
        disabled={isPending}
        className="border-input bg-background text-muted-foreground focus:ring-ring h-7 w-full rounded-md border px-2 text-xs focus:ring-1 focus:outline-none"
        value=""
        onChange={(e) => handleAssign(e.target.value)}
      >
        <option value="" disabled>
          Asignar a…
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error && <p className="text-destructive text-[11px]">{error}</p>}
    </div>
  )
}

// ─── Quick Actions (inline in drawer) ────────────────────────────────────────

export function DrawerQuickActions({
  leadId,
  leadName,
  leadPhone,
  leadEmail,
  senderName,
  aiEnabled,
  googleEnabled,
}: {
  leadId: string
  leadName: string
  leadPhone: string | null
  leadEmail: string | null
  senderName: string
  aiEnabled: boolean
  googleEnabled: boolean
}) {
  const secondaryActionCount = 3 + (googleEnabled ? 3 : 0) + (aiEnabled ? 1 : 0)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        Acciones rápidas
      </p>
      <div className="grid grid-cols-2 gap-1.5 [&_button]:h-auto [&_button]:min-h-8 [&_button]:px-2 [&_button]:text-left [&_button]:whitespace-normal">
        <QCallDialog
          leadId={leadId}
          leadName={leadName}
          leadPhone={leadPhone}
          leadEmail={leadEmail}
          senderName={senderName}
          aiEnabled={aiEnabled}
        />
        <QWhatsAppDialog
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          senderName={senderName}
          aiEnabled={aiEnabled}
        />
        <div className="col-span-2">
          <ScheduleReminderDialog
            leadId={leadId}
            defaultTitle={`Seguimiento de ${leadName}`}
            trigger={
              <Button type="button" size="sm" variant="outline" className="w-full justify-start">
                <CalendarPlus className="text-muted-foreground size-3.5" />
                Programar seguimiento
              </Button>
            }
          />
        </div>
      </div>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group/more w-full justify-between px-2">
            <span className="flex items-center gap-1.5">
              Más acciones
              <span className="text-muted-foreground text-xs font-normal">
                {secondaryActionCount}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 transition-transform group-aria-expanded/more:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1.5">
          <div className="bg-muted/20 flex flex-col gap-3 rounded-lg border p-2">
            <DrawerActionGroup label="Registrar">
              <QSendEmailDialog leadId={leadId} leadEmail={leadEmail} aiEnabled={aiEnabled} />
              <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
              <QNoteDialog leadId={leadId} />
            </DrawerActionGroup>
            {googleEnabled ? (
              <DrawerActionGroup label="Reuniones">
                <QMeetNowDialog leadId={leadId} leadName={leadName} leadEmail={leadEmail} />
                <QMeetDialog
                  leadId={leadId}
                  leadName={leadName}
                  leadEmail={leadEmail}
                  projects={[]}
                />
              </DrawerActionGroup>
            ) : null}
            {googleEnabled || aiEnabled ? (
              <DrawerActionGroup label="Herramientas">
                {googleEnabled ? <GmailSyncButton leadId={leadId} leadEmail={leadEmail} /> : null}
                {aiEnabled ? (
                  <ExtractTasksDialog leadId={leadId} createTaskAction={createTask} />
                ) : null}
              </DrawerActionGroup>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function DrawerActionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground px-1 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}
