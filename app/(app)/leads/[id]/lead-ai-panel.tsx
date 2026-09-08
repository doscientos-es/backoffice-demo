'use client'

import {
  CircleAlert as AlertCircle,
  CalendarDays as CalendarClock,
  Check,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  Sparkle as Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { AiNotice } from '@/components/ui/ai-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  type ScheduleMember,
  ScheduleReminderDialog,
} from '../../reminders/schedule-reminder-dialog'
import { createTask } from '../../tasks/actions'

export type LeadAiData = {
  ai_summary: string | null
  ai_suggested_next_step: string | null
  ai_suggested_next_step_at: string | null
  ai_temperature: 'hot' | 'warm' | 'cold' | null
  ai_confidence: number | null
  ai_updated_at: string | null
  ai_tags: string[] | null
}

type NextBestAction = {
  headline: string
  rationale: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  channel: 'email' | 'whatsapp' | 'call' | 'internal'
  action: string
  message: string
  task: { title: string; description: string }
}

type Props = {
  leadId: string
  aiEnabled: boolean
  initialData: LeadAiData
  briefing: string
  members?: ScheduleMember[]
}

const TEMPERATURE_VARIANT = {
  hot: 'danger',
  warm: 'warning',
  cold: 'info',
} as const

const TEMPERATURE_LABEL = {
  hot: '🔥 Caliente',
  warm: '🌤 Tibio',
  cold: '🧊 Frío',
} as const

function AiSkeleton() {
  return (
    <div className="animate-in fade-in flex flex-col gap-3 duration-200">
      {/* badges row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
      {/* summary lines */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[75%]" />
      </div>
      {/* next step box */}
      <div className="border-border bg-muted/40 flex flex-col gap-1.5 rounded-md border px-3 py-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[60%]" />
      </div>
    </div>
  )
}

function formatAiUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function LeadAiPanel({ leadId, aiEnabled, initialData, briefing, members = [] }: Props) {
  const [data, setData] = useState<LeadAiData>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState(false)
  const [copied, setCopied] = useState(false)
  const [recommendation, setRecommendation] = useState<NextBestAction | null>(null)
  const [recommending, setRecommending] = useState(false)
  const [applyingTask, setApplyingTask] = useState(false)
  const [messageCopied, setMessageCopied] = useState(false)

  async function handleCopyBriefing() {
    try {
      await navigator.clipboard.writeText(briefing)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('No se pudo copiar el briefing al portapapeles.')
    }
  }

  async function handleSummarize() {
    setLoading(true)
    setError(null)
    setFresh(false)
    try {
      const res = await fetch('/api/crm/ai/summarize-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al generar el resumen.')
      setData({
        ai_summary: json.summary,
        ai_suggested_next_step: json.suggested_next_step,
        ai_suggested_next_step_at: json.suggested_next_step_at ?? null,
        ai_temperature: json.temperature,
        ai_confidence: json.confidence,
        ai_updated_at: json.ai_updated_at ?? new Date().toISOString(),
        ai_tags: (json.tags as string[] | null) ?? null,
      })
      setFresh(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecommend() {
    setRecommending(true)
    setError(null)
    try {
      const res = await fetch('/api/crm/ai/next-best-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No se pudo preparar la recomendación.')
      setRecommendation(json as NextBestAction)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setRecommending(false)
    }
  }

  async function handleApplyRecommendedTask() {
    if (!recommendation) return
    setApplyingTask(true)
    setError(null)
    try {
      await createTask({
        title: recommendation.task.title,
        description: recommendation.task.description,
        priority: recommendation.urgency,
        status: 'todo',
        lead_id: leadId,
        project_id: '',
        client_id: '',
        member_ids: [],
        due_date: '',
      })
      setRecommendation((current) =>
        current ? { ...current, task: { ...current.task, title: 'Tarea creada' } } : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea.')
    } finally {
      setApplyingTask(false)
    }
  }

  async function handleCopyMessage() {
    if (!recommendation?.message) return
    await navigator.clipboard.writeText(recommendation.message)
    setMessageCopied(true)
    setTimeout(() => setMessageCopied(false), 1500)
  }

  const hasSummary = Boolean(data.ai_summary)
  const updatedAt = data.ai_updated_at ? formatAiUpdatedAt(data.ai_updated_at) : null

  return (
    <div className="flex flex-col gap-4">
      {!aiEnabled ? (
        <AiNotice message="El asistente de IA interno no está activo. Aun así puedes copiar el briefing para consultarlo con la IA que prefieras." />
      ) : loading ? (
        <AiSkeleton />
      ) : hasSummary ? (
        <div className={cn('flex flex-col gap-3', fresh && 'animate-in fade-in duration-500')}>
          <div className="flex items-center gap-2">
            {data.ai_temperature && (
              <Badge variant={TEMPERATURE_VARIANT[data.ai_temperature]}>
                {TEMPERATURE_LABEL[data.ai_temperature]}
              </Badge>
            )}
            {data.ai_confidence != null && (
              <span className="text-muted-foreground text-xs">
                Confianza: {Math.round(data.ai_confidence * 100)}%
              </span>
            )}
            {updatedAt && (
              <span className="text-muted-foreground ml-auto text-xs">{updatedAt}</span>
            )}
          </div>

          <p className="text-sm leading-relaxed">{data.ai_summary}</p>

          {data.ai_tags && data.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.ai_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {data.ai_suggested_next_step && (
            <div className="border-border bg-muted/40 rounded-md border px-3 py-2">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium">Siguiente paso</p>
                <ScheduleReminderDialog
                  leadId={leadId}
                  defaultTitle={data.ai_suggested_next_step.slice(0, 200)}
                  defaultNotes={data.ai_suggested_next_step}
                  defaultRemindAt={data.ai_suggested_next_step_at}
                  members={members}
                  trigger={
                    <Button size="xs" variant="ghost" className="h-6 gap-1 px-2 text-xs">
                      <CalendarClock className="size-3" />
                      Agendar
                    </Button>
                  }
                />
              </div>
              <p className="text-sm">{data.ai_suggested_next_step}</p>
              {data.ai_suggested_next_step_at && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Fecha sugerida: {new Date(data.ai_suggested_next_step_at).toLocaleString('es-ES')}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Sin análisis generado aún. Pulsa el botón para que la IA analice el lead.
        </p>
      )}

      {error && (
        <div className="text-destructive animate-in fade-in flex items-center gap-1.5 text-xs duration-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {aiEnabled ? (
        <div className="border-primary/15 bg-primary/[0.03] animate-in fade-in slide-in-from-bottom-1 rounded-lg border p-3 duration-300">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Siguiente mejor acción</p>
              <p className="text-muted-foreground text-xs">
                Prioriza una acción concreta según el historial y los silencios.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleRecommend} disabled={recommending}>
              <Sparkles className={cn('size-3.5', recommending && 'animate-spin')} />
              {recommending ? 'Pensando…' : recommendation ? 'Recalcular' : 'Recomendar'}
            </Button>
          </div>
          {recommendation ? (
            <div className="animate-in fade-in mt-3 flex flex-col gap-3 duration-300">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    recommendation.urgency === 'urgent'
                      ? 'danger'
                      : recommendation.urgency === 'high'
                        ? 'warning'
                        : 'outline'
                  }
                >
                  {recommendation.urgency === 'urgent'
                    ? 'Urgente'
                    : recommendation.urgency === 'high'
                      ? 'Prioritaria'
                      : 'Seguimiento'}
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <ChannelIcon channel={recommendation.channel} /> {recommendation.channel}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{recommendation.headline}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {recommendation.rationale}
                </p>
              </div>
              <p className="bg-background/70 rounded-md p-2 text-sm">{recommendation.action}</p>
              {recommendation.message ? (
                <div>
                  <div className="mb-1 flex justify-between">
                    <p className="text-muted-foreground text-xs font-medium">
                      Borrador para revisar
                    </p>
                    <Button size="xs" variant="ghost" onClick={handleCopyMessage}>
                      {messageCopied ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {messageCopied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                  <Textarea
                    value={recommendation.message}
                    onChange={(event) =>
                      setRecommendation({ ...recommendation, message: event.target.value })
                    }
                    rows={5}
                    className="text-sm"
                  />
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={applyingTask || recommendation.task.title === 'Tarea creada'}
                  onClick={handleApplyRecommendedTask}
                >
                  {applyingTask
                    ? 'Creando…'
                    : recommendation.task.title === 'Tarea creada'
                      ? 'Tarea creada'
                      : 'Crear tarea'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-border bg-muted/30 rounded-md border px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Briefing para otra IA</p>
            <p className="text-muted-foreground text-xs">
              Incluye ficha, historial, actividad y contexto comercial registrado.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleCopyBriefing}>
            {copied ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? 'Copiado' : 'Copiar briefing'}
          </Button>
        </div>
      </div>

      {aiEnabled ? (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handleSummarize} disabled={loading}>
            <Sparkles className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Analizando…' : hasSummary ? 'Actualizar análisis' : 'Generar análisis'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ChannelIcon({ channel }: { channel: NextBestAction['channel'] }) {
  if (channel === 'email') return <Mail className="size-3" />
  if (channel === 'whatsapp') return <MessageCircle className="size-3" />
  if (channel === 'call') return <Phone className="size-3" />
  return <Sparkles className="size-3" />
}
