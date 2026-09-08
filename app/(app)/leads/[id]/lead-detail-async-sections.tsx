import { ArrowRight, Clock as Clock3, ExternalLink } from 'lucide-react'

import { createTask } from '@/app/(app)/tasks/actions'
import { type AttachmentItem, AttachmentSection } from '@/components/ui/attachment-section'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { findClarityPlaybackUrl } from '@/lib/conversion-events/journeys'
import { CONVERSION_EVENT_LABEL, CONVERSION_STEP_LABEL } from '@/lib/conversion-events/labels'
import { listLeadConversionEvents } from '@/lib/conversion-events/queries'
import { listLeadDiagnostics } from '@/lib/diagnostics/queries'
import { isGoogleEnabled } from '@/lib/env'
import type { MemberOption } from '@/lib/members/queries'
import { MEETING_PROJECT_STATUSES } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'

import { LeadDetailDisclosure } from './lead-detail-disclosure'
import { LeadQuickActions } from './quick-actions'

function formatJourneyTime(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export async function LeadConversionJourneySection({
  leadId,
  eventId,
}: {
  leadId: string
  eventId: string | null
}) {
  const events = await listLeadConversionEvents({ id: leadId, event_id: eventId })
  const journeyEvents = [...events].reverse()
  const clarityUrl = findClarityPlaybackUrl(events)

  return (
    <LeadDetailDisclosure
      id="conversion-journey"
      title="Journey de conversión"
      description="Visitas y señales que llevaron a este lead."
      action={
        clarityUrl ? (
          <a
            href={clarityUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
          >
            Ver grabación <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null
      }
    >
      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Sin eventos de landing vinculados a este lead.
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <ol className="flex min-w-max items-center gap-3" aria-label="Pasos del journey">
            {journeyEvents.map((event, index) => {
              const isConversion = ['lead_created', 'form_submit', 'whatsapp_click'].includes(
                event.event_name,
              )
              const attribution = [event.utm_source, event.utm_medium, event.utm_campaign]
                .filter(Boolean)
                .join(' · ')
              const detail =
                CONVERSION_STEP_LABEL[event.conversion_step ?? ''] ??
                (attribution || event.landing_ref || 'Sin UTM/ref')

              return (
                <li key={event.id} className="flex items-center gap-3">
                  <article className="border-border bg-muted/30 w-52 rounded-lg border p-3 shadow-sm">
                    <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Clock3 className="size-3" aria-hidden="true" />
                        <time dateTime={event.created_at}>
                          {formatJourneyTime(event.created_at)}
                        </time>
                      </span>
                      <span className="font-medium">{index + 1}</span>
                    </div>
                    <Badge
                      className="mt-2 max-w-full"
                      variant={isConversion ? 'success' : 'neutral'}
                    >
                      <span className="truncate">
                        {CONVERSION_EVENT_LABEL[event.event_name] ?? event.event_name}
                      </span>
                    </Badge>
                    <p className="mt-2 truncate text-sm font-medium">
                      {event.landing_path ?? event.referrer ?? 'Evento sin página'}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{detail}</p>
                  </article>
                  {index < journeyEvents.length - 1 && (
                    <ArrowRight
                      className="text-muted-foreground/60 size-4 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </LeadDetailDisclosure>
  )
}

export async function LeadDiagnosticsSection({ leadId }: { leadId: string }) {
  const diagnostics = await listLeadDiagnostics(leadId)

  if (diagnostics.length === 0) {
    return null
  }

  return (
    <LeadDetailDisclosure
      id="diagnostics"
      title="Diagnósticos personalizados"
      description={`${diagnostics.length} ${diagnostics.length === 1 ? 'diagnóstico disponible' : 'diagnósticos disponibles'}.`}
    >
      <div className="space-y-4">
        {diagnostics.map((diagnostic) => (
          <div key={diagnostic.id} className="border-border rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{diagnostic.company || diagnostic.email}</p>
              <Badge variant={diagnostic.report_opened_at ? 'success' : 'neutral'}>
                {diagnostic.report_opened_at
                  ? 'Informe abierto'
                  : diagnostic.report_sent_at
                    ? 'Informe enviado'
                    : 'Completado'}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {diagnostic.metrics.monthlyHours ?? '—'} h/mes ·{' '}
              {diagnostic.metrics.yearlyHours ?? '—'} h/año · {diagnostic.metrics.risk ?? '—'}
            </p>
            {diagnostic.metrics.primaryOpportunity ? (
              <p className="text-muted-foreground mt-2 text-xs">
                {diagnostic.metrics.primaryOpportunity}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </LeadDetailDisclosure>
  )
}

export async function LeadAttachmentsSection({
  leadId,
  canEdit,
}: {
  leadId: string
  canEdit: boolean
}) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('attachments')
    .select('id, name, mime_type, size_bytes, created_at, source, drive_file_id, web_view_link')
    .eq('lead_id', leadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (
    <AttachmentSection
      entityType="lead"
      entityId={leadId}
      attachments={(data ?? []) as AttachmentItem[]}
      canEdit={canEdit}
    />
  )
}

export async function LeadQuickActionsSection({
  lead,
  senderName,
  canEdit,
  openCallInitially,
  openScheduleInitially,
  defaultDurationMinutes,
  aiEnabled,
  scheduleMembers,
}: {
  lead: {
    id: string
    name: string
    email: string | null
    phone: string | null
    assigned_to: string | null
  }
  senderName: string
  canEdit: boolean
  openCallInitially: boolean
  openScheduleInitially: boolean
  defaultDurationMinutes: number | null
  aiEnabled: boolean
  scheduleMembers: MemberOption[]
}) {
  const googleEnabled = isGoogleEnabled()
  const supabase = await createServerClient()
  const projectsRequest = googleEnabled
    ? supabase
        .from('projects')
        .select('id, name')
        .is('deleted_at', null)
        .in('status', MEETING_PROJECT_STATUSES)
        .order('name')
    : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null })
  const membersRequest = googleEnabled
    ? supabase.from('team_members').select('id, name, email').is('deleted_at', null).order('name')
    : Promise.resolve({
        data: [] as Array<{ id: string; name: string; email: string }>,
        error: null,
      })
  const [projectsResult, membersResult] = await Promise.all([projectsRequest, membersRequest])

  if (projectsResult.error) throw new Error(projectsResult.error.message)
  if (membersResult.error) throw new Error(membersResult.error.message)

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle>Acciones rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <LeadQuickActions
          leadId={lead.id}
          leadName={lead.name}
          leadEmail={lead.email}
          leadPhone={lead.phone}
          senderName={senderName}
          openCallInitially={openCallInitially}
          openScheduleInitially={openScheduleInitially}
          defaultDurationMinutes={defaultDurationMinutes}
          claimable={canEdit && !lead.assigned_to}
          aiEnabled={aiEnabled}
          googleEnabled={googleEnabled}
          projects={projectsResult.data ?? []}
          meetMembers={(membersResult.data ?? []).map((member) => ({
            id: member.id,
            name: member.name,
            email: member.email ?? '',
          }))}
          scheduleMembers={scheduleMembers}
          createTaskAction={createTask}
        />
      </CardContent>
    </Card>
  )
}
