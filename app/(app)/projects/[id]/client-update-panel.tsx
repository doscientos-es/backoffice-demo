'use client'

import { CircleAlert as AlertCircle, Check, Copy, Sparkle as Sparkles } from 'lucide-react'
import { useState } from 'react'

import { AiNotice } from '@/components/ui/ai-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Props = {
  projectId: string
  aiEnabled: boolean
}

type ProjectUpdate = {
  health: 'on_track' | 'attention' | 'blocked'
  summary: string
  progress: string[]
  risks: string[]
  next_steps: string[]
  client_update: string
}

const HEALTH = {
  on_track: { label: 'En curso', variant: 'success' as const },
  attention: { label: 'Atención', variant: 'warning' as const },
  blocked: { label: 'Bloqueado', variant: 'danger' as const },
}

export function ClientUpdatePanel({ projectId, aiEnabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [update, setUpdate] = useState<ProjectUpdate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!aiEnabled) {
    return (
      <AiNotice message="La IA no está disponible. Añade AI_PROVIDER a las variables de entorno para generar updates de cliente." />
    )
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setUpdate(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-client-update`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al generar el update.')
      setUpdate(json.update as ProjectUpdate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!update) return
    await navigator.clipboard.writeText(update.client_update)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      {loading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {error && (
        <div className="text-destructive animate-in fade-in flex items-center gap-1.5 text-xs duration-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {update && !loading && (
        <div className={cn('flex flex-col gap-2 animate-in fade-in duration-500')}>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-xs"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <div className="border-primary/15 bg-primary/[0.03] animate-in fade-in slide-in-from-bottom-1 rounded-lg border p-3 duration-300">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={HEALTH[update.health].variant}>{HEALTH[update.health].label}</Badge>
              <p className="text-sm font-medium">{update.summary}</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <UpdateList title="Avances" items={update.progress} />
              <UpdateList title="Siguientes pasos" items={update.next_steps} />
              {update.risks.length > 0 ? (
                <UpdateList title="Riesgos a vigilar" items={update.risks} tone="warning" />
              ) : null}
            </div>
          </div>
          <textarea
            value={update.client_update}
            onChange={(event) => setUpdate({ ...update, client_update: event.target.value })}
            rows={10}
            className="border-border bg-muted/30 text-foreground focus-visible:ring-ring w-full resize-y rounded-md border p-3 text-sm leading-relaxed outline-none focus-visible:ring-2"
            aria-label="Borrador de update para el cliente"
          />
        </div>
      )}

      {!update && !loading && !error && (
        <p className="text-muted-foreground text-sm">
          Genera un update profesional listo para enviar a tu cliente, basado en las tareas y
          registros de trabajo del proyecto.
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {update && !loading && (
          <span className="text-muted-foreground text-xs">
            Revisa el texto antes de enviarlo al cliente.
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={loading}
          className="ml-auto"
        >
          <Sparkles className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {loading ? 'Generando…' : update ? 'Regenerar' : 'Generar update'}
        </Button>
      </div>
    </div>
  )
}

function UpdateList({ title, items, tone }: { title: string; items: string[]; tone?: 'warning' }) {
  if (items.length === 0) return null
  return (
    <div
      className={cn(
        'rounded-md bg-background/70 p-2.5',
        tone === 'warning' && 'ring-1 ring-amber-500/20',
      )}
    >
      <p className="text-muted-foreground mb-1 text-xs font-medium">{title}</p>
      <ul className="space-y-1 text-xs leading-relaxed">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="text-muted-foreground">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
