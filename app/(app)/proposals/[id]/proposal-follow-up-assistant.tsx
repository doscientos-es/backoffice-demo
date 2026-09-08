'use client'

import { Check, Copy, Mail, MessageCircle, Phone, Sparkle as Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { createTask } from '../../tasks/actions'

type Recommendation = {
  headline: string
  rationale: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  channel: 'email' | 'whatsapp' | 'call' | 'internal'
  action: string
  message: string
  task: { title: string; description: string }
}

export function ProposalFollowUpAssistant({
  proposalId,
  leadId,
  clientId,
}: {
  proposalId: string
  leadId: string | null
  clientId: string | null
}) {
  const [data, setData] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/crm/ai/next-best-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposalId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'No se pudo preparar el seguimiento.')
      setData(json as Recommendation)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  async function applyTask() {
    if (!data) return
    setApplying(true)
    setError(null)
    try {
      await createTask({
        title: data.task.title,
        description: data.task.description,
        priority: data.urgency,
        status: 'todo',
        lead_id: leadId ?? '',
        client_id: clientId ?? '',
        project_id: '',
        member_ids: [],
        due_date: '',
      })
      setData({ ...data, task: { ...data.task, title: 'Tarea creada' } })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la tarea.')
    } finally {
      setApplying(false)
    }
  }

  async function copyMessage() {
    if (!data?.message) return
    await navigator.clipboard.writeText(data.message)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Asistente de seguimiento</p>
          <p className="text-muted-foreground text-xs">
            Una propuesta accionable, no un envío automático.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          <Sparkles className={cn('size-3.5', loading && 'animate-spin')} />
          {loading ? 'Analizando…' : data ? 'Actualizar' : 'Preparar acción'}
        </Button>
      </div>
      {data ? (
        <div className="border-primary/15 bg-primary/[0.03] animate-in fade-in slide-in-from-bottom-1 rounded-lg border p-3 duration-300">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                data.urgency === 'urgent'
                  ? 'danger'
                  : data.urgency === 'high'
                    ? 'warning'
                    : 'outline'
              }
            >
              {data.urgency === 'high'
                ? 'Prioritaria'
                : data.urgency === 'urgent'
                  ? 'Urgente'
                  : 'Seguimiento'}
            </Badge>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <ChannelIcon channel={data.channel} /> {data.channel}
            </span>
          </div>
          <p className="mt-3 text-sm font-medium">{data.headline}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{data.rationale}</p>
          <p className="bg-background/70 mt-3 rounded-md p-2 text-sm">{data.action}</p>
          {data.message ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between">
                <p className="text-muted-foreground text-xs font-medium">Borrador para revisar</p>
                <Button size="xs" variant="ghost" onClick={copyMessage}>
                  {copied ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <Textarea
                value={data.message}
                onChange={(event) => setData({ ...data, message: event.target.value })}
                rows={5}
              />
            </div>
          ) : null}
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={applyTask}
              disabled={applying || data.task.title === 'Tarea creada'}
            >
              {applying
                ? 'Creando…'
                : data.task.title === 'Tarea creada'
                  ? 'Tarea creada'
                  : 'Crear tarea'}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  )
}

function ChannelIcon({ channel }: { channel: Recommendation['channel'] }) {
  if (channel === 'email') return <Mail className="size-3" />
  if (channel === 'whatsapp') return <MessageCircle className="size-3" />
  if (channel === 'call') return <Phone className="size-3" />
  return <Sparkles className="size-3" />
}
