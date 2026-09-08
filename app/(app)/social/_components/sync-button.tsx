'use client'

import { CheckCircle, RefreshCw, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { syncComments, syncInsights, syncSocial } from '../actions'

type Phase = 'idle' | 'loading' | 'success' | 'error'

/**
 * Pulls fresh insights or comments from every configured network. One button,
 * two use-cases, selected by `kind` — keeps the sync UX identical everywhere.
 */
export function SyncButton({
  kind,
  label,
}: {
  kind: 'insights' | 'comments' | 'social'
  label?: string
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  async function handle() {
    setPhase('loading')
    setMsg(null)
    let result: Awaited<ReturnType<typeof syncInsights>> | Awaited<ReturnType<typeof syncSocial>>
    let resultMessage = ''
    try {
      if (kind === 'social') {
        const socialResult = await syncSocial()
        result = socialResult
        if (socialResult.ok) {
          resultMessage = `${socialResult.insightsSynced} métricas · ${socialResult.commentsSynced} comentarios`
        }
      } else {
        const basicResult = await (kind === 'insights' ? syncInsights() : syncComments())
        result = basicResult
        if (basicResult.ok) resultMessage = `${basicResult.synced} actualizados`
      }
    } catch (err) {
      setPhase('error')
      setMsg(err instanceof Error ? err.message : 'Error inesperado')
      return
    }
    if (!result.ok) {
      setPhase('error')
      setMsg(result.error)
      return
    }
    setPhase('success')
    setMsg(resultMessage)
    router.refresh()
    setTimeout(() => setPhase('idle'), 2500)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handle}
        disabled={phase === 'loading'}
        variant="outline"
        size="sm"
        aria-busy={phase === 'loading' || undefined}
        className={cn(
          phase === 'success' && 'border-success/50 text-success',
          phase === 'error' && 'border-destructive/50 text-destructive',
        )}
      >
        {phase === 'success' ? (
          <CheckCircle className="text-success size-3.5" />
        ) : phase === 'error' ? (
          <XCircle className="text-destructive size-3.5" />
        ) : (
          <RefreshCw className={cn('size-3.5', phase === 'loading' && 'animate-spin')} />
        )}
        {phase === 'loading' ? 'Sincronizando…' : (label ?? 'Sincronizar')}
      </Button>
      {phase !== 'idle' && phase !== 'loading' && msg && (
        <p
          className={cn(
            'max-w-xs text-right text-xs',
            phase === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {msg}
        </p>
      )}
    </div>
  )
}
