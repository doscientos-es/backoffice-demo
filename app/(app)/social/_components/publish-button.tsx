'use client'

import { CheckCircle, Send, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { PLATFORM_LABELS } from '@/lib/social/core'
import { cn } from '@/lib/utils'

import { publishPost } from '../actions'

type Phase = 'idle' | 'loading' | 'success' | 'error'

/**
 * Publishes (or retries) a post from the dashboard/detail. Optimistic phase
 * feedback with a router refresh so the fan-out result lands in the list.
 */
export function PublishButton({
  postId,
  label = 'Publicar',
  retry = false,
  size = 'sm',
  variant,
  className,
}: {
  postId: string
  label?: string
  retry?: boolean
  size?: React.ComponentProps<typeof Button>['size']
  variant?: React.ComponentProps<typeof Button>['variant']
  className?: string
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handle() {
    setPhase('loading')
    setError(null)
    let res: Awaited<ReturnType<typeof publishPost>>
    try {
      res = await publishPost({ postId })
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Error inesperado')
      return
    }
    if (!res.ok) {
      setPhase('error')
      setError(res.error)
      return
    }

    // Show per-network toasts so the user knows exactly what happened.
    const failed = res.targets.filter((t) => !t.ok)
    const succeeded = res.targets.filter((t) => t.ok)
    const labels = PLATFORM_LABELS as Record<string, string>
    for (const t of failed) {
      sileo.error({
        title: `${labels[t.platform] ?? t.platform}: publicación fallida`,
        description: t.error ?? 'Error desconocido',
      })
    }
    if (succeeded.length > 0 && failed.length === 0) {
      sileo.success({ title: 'Publicado correctamente en todas las redes' })
    } else if (succeeded.length > 0) {
      sileo.success({
        title: `Publicado en ${succeeded.map((t) => labels[t.platform] ?? t.platform).join(', ')}`,
      })
    }

    setPhase('success')
    router.refresh()
    setTimeout(() => setPhase('idle'), 2500)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handle}
        disabled={phase === 'loading'}
        size={size}
        variant={variant ?? (retry ? 'outline' : 'default')}
        aria-busy={phase === 'loading' || undefined}
        className={cn(
          phase === 'success' && 'border-success/50 text-success',
          phase === 'error' && 'border-destructive/50 text-destructive',
          className,
        )}
      >
        {phase === 'success' ? (
          <CheckCircle className="size-3.5" />
        ) : phase === 'error' ? (
          <XCircle className="size-3.5" />
        ) : (
          <Send className={cn('size-3.5', phase === 'loading' && 'animate-pulse')} />
        )}
        {phase === 'loading' ? 'Publicando…' : retry ? 'Reintentar' : label}
      </Button>
      {phase === 'error' && error && (
        <p className="text-destructive max-w-xs text-right text-xs">{error}</p>
      )}
    </div>
  )
}
