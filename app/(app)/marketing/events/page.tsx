import {
  ChevronRight,
  Circle as CircleDot,
  Clipboard as ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  MessageCircle,
  MousePointerClick,
  Send,
  UserCheck,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/layout/stat-card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@doscientos/ui'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { requirePageRole } from '@/lib/auth'
import { groupIntoJourneys, type VisitorJourney } from '@/lib/conversion-events/journeys'
import { eventLabel, stepLabel } from '@/lib/conversion-events/labels'
import { type ConversionEventRow, listConversionEvents } from '@/lib/conversion-events/queries'
import { formatDateTime, relativeTime, truncate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function param(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function EventBadge({ name }: { name: string }) {
  const variant =
    name === 'whatsapp_click' || name === 'lead_created'
      ? 'success'
      : name.includes('diagnostic')
        ? 'info'
        : 'neutral'
  return <Badge variant={variant}>{eventLabel(name)}</Badge>
}

function eventIcon(name: string): ComponentType<SVGProps<SVGSVGElement>> {
  if (name === 'page_view') return Eye
  if (name === 'whatsapp_click') return MessageCircle
  if (name === 'cta_click') return MousePointerClick
  if (name === 'form_started') return FileText
  if (name === 'form_submit') return Send
  if (name === 'lead_created') return UserCheck
  if (name.includes('diagnostic')) return ClipboardList
  return CircleDot
}

function JourneyEventRow({ event }: { event: ConversionEventRow }) {
  const Icon = eventIcon(event.event_name)
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <span className="border-border bg-background text-muted-foreground relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <EventBadge name={event.event_name} />
            {event.conversion_step && (
              <span className="text-muted-foreground text-xs">
                {stepLabel(event.conversion_step)}
              </span>
            )}
          </div>
          <time
            dateTime={event.created_at}
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
          >
            {formatDateTime(event.created_at)}
          </time>
        </div>
        <p
          className="text-muted-foreground mt-1 truncate text-xs"
          title={event.landing_path ?? undefined}
        >
          {event.landing_path ?? '—'}
          {event.landing_ref && ` · ref: ${event.landing_ref}`}
        </p>
      </div>
    </div>
  )
}

function JourneyCard({ journey }: { journey: VisitorJourney }) {
  const visitorParam = journey.visitorIds[0]
  const previewEvents = (
    journey.events.length > 4 ? [journey.events[0], ...journey.events.slice(-3)] : journey.events
  ).filter((event): event is ConversionEventRow => event !== undefined)
  const hiddenEvents = journey.events.length - previewEvents.length
  const converted = Boolean(journey.lead)

  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                converted
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {converted ? (
                <UserCheck className="size-4" aria-hidden />
              ) : (
                <Users className="size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {journey.lead ? (
                  <Link
                    href={`/leads/${journey.lead.id}`}
                    className="hover:text-primary font-medium"
                  >
                    {journey.lead.name}
                  </Link>
                ) : (
                  <span className="font-medium">Visitante anónimo</span>
                )}
                {converted && <Badge variant="success">Lead</Badge>}
                {journey.hasWhatsappClick && <Badge variant="info">WhatsApp</Badge>}
              </div>
              <p className="text-muted-foreground mt-1 truncate text-xs">
                <span className="text-foreground">
                  {journey.entryPath ?? 'Sin página de entrada'}
                </span>
                <span className="text-muted-foreground/60 px-1.5">·</span>
                {journey.source}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {journey.clarityUrl && (
              <a
                href={journey.clarityUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Clarity <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
            <div className="text-muted-foreground text-right text-xs">
              <p className="text-foreground font-medium">{relativeTime(journey.lastSeen)}</p>
              <p>
                {journey.events.length} {journey.events.length === 1 ? 'evento' : 'eventos'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-border bg-muted/30 rounded-lg border px-3 py-2.5">
          <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
            Recorrido
          </p>
          <ol
            className="flex items-center gap-1 overflow-x-auto pb-0.5"
            aria-label="Resumen del recorrido"
          >
            {previewEvents.map((event, index) => {
              const Icon = eventIcon(event.event_name)
              return (
                <li key={event.id} className="flex shrink-0 items-center gap-1">
                  {index > 0 && (
                    <ChevronRight className="text-muted-foreground/60 size-3.5" aria-hidden />
                  )}
                  {index === 1 && hiddenEvents > 0 && (
                    <span className="text-muted-foreground text-xs">+{hiddenEvents}</span>
                  )}
                  <span className="bg-background text-foreground ring-border inline-flex max-w-44 items-center gap-1.5 rounded-md px-2 py-1 text-xs ring-1">
                    <Icon className="text-muted-foreground size-3 shrink-0" aria-hidden />
                    <span className="truncate">{eventLabel(event.event_name)}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        {journey.events.length > 1 && (
          <Accordion allowsMultipleExpanded={false}>
            <AccordionItem id="timeline" className="border-b-0">
              <AccordionTrigger className="text-muted-foreground py-0 text-xs hover:no-underline">
                Ver cronología detallada
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <div className="before:bg-border relative before:absolute before:top-3 before:bottom-3 before:left-3.5 before:w-px">
                  {journey.events.map((event) => (
                    <JourneyEventRow key={event.id} event={event} />
                  ))}
                </div>
                {visitorParam && (
                  <Link
                    href={`/marketing/events?visitor=${visitorParam}`}
                    className="text-primary mt-1 inline-block text-xs font-medium hover:underline"
                  >
                    Ver todos los eventos de este visitante
                  </Link>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}

export default async function ConversionEventsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requirePageRole(['owner', 'admin'])
  const sp = await searchParams
  const eventName = param(sp.event)
  const visitorId = param(sp.visitor)
  const events = await listConversionEvents({ eventName, visitorId, limit: 300 })
  const journeys = groupIntoJourneys(events)
  const convertedCount = journeys.filter((j) => j.lead).length
  const whatsappCount = journeys.filter((j) => j.hasWhatsappClick).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Eventos de conversión"
        description="Recorridos de visitantes desde la primera visita hasta la conversión, agrupados por persona."
        breadcrumbs={[{ label: 'Marketing', href: '/marketing' }, { label: 'Eventos' }]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Visitantes"
          value={journeys.length}
          icon={Users}
          hint="recorridos registrados"
        />
        <StatCard
          label="Convirtieron a lead"
          value={convertedCount}
          tone="success"
          icon={UserCheck}
          hint="recorridos identificados"
        />
        <StatCard
          label="Con clic en WhatsApp"
          value={whatsappCount}
          tone="info"
          icon={MessageCircle}
          hint="interés directo"
        />
      </div>

      {(eventName || visitorId) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>
            Filtrando por
            {eventName && (
              <>
                {' '}
                evento <span className="text-foreground font-medium">{eventLabel(eventName)}</span>
              </>
            )}
            {eventName && visitorId && ' y'}
            {visitorId && (
              <>
                {' '}
                visitante{' '}
                <span className="text-foreground font-medium">{truncate(visitorId, 14)}</span>
              </>
            )}
          </span>
          <Link href="/marketing/events" className="text-primary hover:underline">
            Quitar filtro
          </Link>
        </div>
      )}

      {journeys.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No hay eventos con estos filtros.
          </CardContent>
        </Card>
      ) : (
        <section className="flex flex-col gap-3" aria-label="Recorridos de visitantes">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-medium">Actividad reciente</h2>
            <span className="text-muted-foreground text-xs">
              {journeys.length} {journeys.length === 1 ? 'recorrido' : 'recorridos'}
            </span>
          </div>
          {journeys.map((journey) => (
            <JourneyCard key={journey.key} journey={journey} />
          ))}
        </section>
      )}
    </div>
  )
}
