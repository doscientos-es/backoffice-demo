'use client'

import { CheckCircle, Download, RefreshCw, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { importHistoricalInstagram } from '../actions'

type Phase = 'idle' | 'loading' | 'success' | 'error'

/** Imports remote Instagram media into the local Social Hub list. */
export function ImportInstagramButton() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handle() {
    setPhase('loading')
    setMessage(null)
    try {
      const result = await importHistoricalInstagram()
      if (!result.ok) {
        setPhase('error')
        setMessage(result.error)
        return
      }
      setPhase('success')
      const failed = result.failed > 0 ? ` · ${result.failed} con error` : ''
      setMessage(`${result.imported} nuevas · ${result.skipped} ya existentes${failed}`)
      router.refresh()
      setTimeout(() => setPhase('idle'), 3000)
    } catch (error) {
      setPhase('error')
      setMessage(error instanceof Error ? error.message : 'Error inesperado')
    }
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
          <CheckCircle className="size-3.5" />
        ) : phase === 'error' ? (
          <XCircle className="size-3.5" />
        ) : phase === 'loading' ? (
          <RefreshCw className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {phase === 'loading' ? 'Importando…' : 'Importar Instagram'}
      </Button>
      {message && phase !== 'loading' && (
        <p
          className={cn(
            'max-w-xs text-right text-xs',
            phase === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
}
