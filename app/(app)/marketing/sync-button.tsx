'use client'

import { CheckCircle, RefreshCw, XCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { syncMetaAction } from './actions'

type SyncStatus = 'idle' | 'loading' | 'success' | 'error'

function syncErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : 'Error inesperado al sincronizar'
  }
  return 'Error inesperado al sincronizar'
}

export function SyncMarketingButton() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSync() {
    setStatus('loading')
    setErrorMsg(null)

    let result: Awaited<ReturnType<typeof syncMetaAction>>
    try {
      result = await syncMetaAction(searchParams.get('range') ?? undefined)
    } catch (err) {
      setStatus('error')
      setErrorMsg(syncErrorMessage(err))
      return
    }

    if (!result.ok) {
      setStatus('error')
      setErrorMsg(syncErrorMessage(result.error))
      return
    }

    setStatus('success')
    router.refresh()
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleSync}
        disabled={status === 'loading'}
        variant="outline"
        size="sm"
        className={cn(
          status === 'success' && 'border-success/50 text-success',
          status === 'error' && 'border-destructive/50 text-destructive',
        )}
      >
        {status === 'loading' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
        {status === 'success' && <CheckCircle className="text-success mr-2 h-4 w-4" />}
        {status === 'error' && <XCircle className="text-destructive mr-2 h-4 w-4" />}
        {status === 'idle' && <RefreshCw className="mr-2 h-4 w-4" />}
        {status === 'loading'
          ? 'Sincronizando...'
          : status === 'success'
            ? '¡Sincronizado!'
            : 'Sincronizar Meta Ads'}
      </Button>

      {status === 'error' && errorMsg && (
        <p className="text-destructive max-w-xs text-right text-xs">{errorMsg}</p>
      )}
    </div>
  )
}
