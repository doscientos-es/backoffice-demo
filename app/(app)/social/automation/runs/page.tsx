import { CircleAlert, Clock as Clock3, Camera as Instagram, MessageCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import type {
  AutomationEventOutcome,
  AutomationRunStatus,
  MetaPlatform,
} from '@/lib/social/automation/types'
import { type AutomationAuditItem, listAutomationAudit } from '@/lib/social/repo'

export const metadata: Metadata = { title: 'Actividad · Automatizaciones · doscientos' }
export const dynamic = 'force-dynamic'

const OUTCOMES: Array<{ value: AutomationEventOutcome; label: string }> = [
  { value: 'completed', label: 'Completados' },
  { value: 'failed', label: 'Fallidos' },
  { value: 'ignored_no_rule', label: 'Sin regla' },
  { value: 'ignored_no_target', label: 'Post no sincronizado' },
]

function statusLabel(status: AutomationRunStatus | null): string {
  if (!status) return '—'
  return { pending: 'Pendiente', sending: 'Enviando', sent: 'Enviado', failed: 'Fallido' }[status]
}

function outcomeVariant(outcome: AutomationEventOutcome) {
  if (outcome === 'completed') return 'success' as const
  if (outcome === 'failed') return 'danger' as const
  if (outcome.startsWith('ignored')) return 'neutral' as const
  return 'info' as const
}

function outcomeLabel(outcome: AutomationEventOutcome): string {
  return {
    received: 'Recibido',
    ignored_self: 'Cuenta propia',
    ignored_no_target: 'Post no sincronizado',
    ignored_no_rule: 'Sin regla coincidente',
    matched: 'Regla encontrada',
    completed: 'Completado',
    failed: 'Fallido',
  }[outcome]
}

function platformLabel(platform: MetaPlatform) {
  return platform === 'instagram' ? 'Instagram' : 'Facebook'
}

function PlatformIcon({ platform }: { platform: MetaPlatform }) {
  return platform === 'instagram' ? (
    <Instagram className="size-3.5" />
  ) : (
    <MessageCircle className="size-3.5" />
  )
}

function EventRow({ event }: { event: AutomationAuditItem }) {
  const isFailure = event.outcome === 'failed'
  return (
    <div className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="bg-muted mt-0.5 rounded-md p-1.5">
            <PlatformIcon platform={event.platform} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {event.authorName || 'Usuario desconocido'}
              </span>
              <span className="text-muted-foreground text-xs">{platformLabel(event.platform)}</span>
              <Badge variant={outcomeVariant(event.outcome)}>{outcomeLabel(event.outcome)}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {new Intl.DateTimeFormat('es-ES', {
                dateStyle: 'short',
                timeStyle: 'medium',
              }).format(new Date(event.createdAt))}
            </p>
          </div>
        </div>
        <span className="text-muted-foreground max-w-[28ch] truncate text-[11px]">
          Post: {event.postCaption || event.remotePostId}
        </span>
      </div>

      <p className="bg-muted/50 text-foreground rounded-lg px-3 py-2 text-xs">
        “{event.commentText}”
      </p>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-muted-foreground">Mensaje privado</span>
          <span className={event.privateStatus === 'failed' ? 'text-destructive' : 'font-medium'}>
            {statusLabel(event.privateStatus)}
          </span>
        </div>
        <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-muted-foreground">Respuesta pública</span>
          <span className={event.publicStatus === 'failed' ? 'text-destructive' : 'font-medium'}>
            {statusLabel(event.publicStatus)}
          </span>
        </div>
      </div>

      {isFailure && event.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{event.error}</span>
        </div>
      ) : null}
    </div>
  )
}

type SearchParams = Promise<{ outcome?: string; platform?: string }>

export default async function SocialAutomationRunsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireUser()
  const params = await searchParams
  const outcome = OUTCOMES.some((item) => item.value === params.outcome)
    ? (params.outcome as AutomationEventOutcome)
    : undefined
  const platform =
    params.platform === 'instagram' || params.platform === 'facebook'
      ? (params.platform as MetaPlatform)
      : undefined
  const events = await listAutomationAudit({ outcome, platform })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actividad de automatizaciones"
        description="Consulta quién comentó, qué regla se aplicó y si falló el mensaje privado o la respuesta pública."
        back={<BackLink href="/social/automation" label="Volver a automatizaciones" />}
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant={!outcome && !platform ? 'secondary' : 'outline'} size="sm">
          <Link href="/social/automation/runs">Todos</Link>
        </Button>
        {OUTCOMES.map((item) => (
          <Button
            key={item.value}
            asChild
            variant={outcome === item.value ? 'secondary' : 'outline'}
            size="sm"
          >
            <Link href={`/social/automation/runs?outcome=${item.value}`}>{item.label}</Link>
          </Button>
        ))}
        <Button asChild variant={platform === 'instagram' ? 'secondary' : 'outline'} size="sm">
          <Link href="/social/automation/runs?platform=instagram">Instagram</Link>
        </Button>
        <Button asChild variant={platform === 'facebook' ? 'secondary' : 'outline'} size="sm">
          <Link href="/social/automation/runs?platform=facebook">Facebook</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Clock3 className="text-muted-foreground size-5" />
              <p className="text-sm font-medium">No hay actividad con estos filtros</p>
              <p className="text-muted-foreground max-w-md text-xs">
                Los comentarios nuevos aparecerán aquí aunque no coincidan con ninguna regla.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
