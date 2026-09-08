'use client'

import { CircleAlert as AlertCircle, Check, LoaderCircle as Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AutosaveStatus } from '../hooks/use-autosave'
import { cn } from '../lib/utils'

type AutosaveIndicatorProps = {
  status: AutosaveStatus
  savedAt: number | null
  error?: string | null
  className?: string
}

/**
 * Inline status indicator for `useAutosave`.
 *
 * Renders three visual states:
 *   - saving  → spinner + "Guardando…"
 *   - saved   → check + relative time "Guardado hace 5 s"
 *   - error   → alert + error message
 */
export function AutosaveIndicator({ status, savedAt, error, className }: AutosaveIndicatorProps) {
  const relative = useRelativeTime(savedAt)

  if (status === 'idle' && !savedAt) return null

  const isSaving = status === 'saving'
  const isError = status === 'error'

  return (
    <span
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(
        'inline-flex h-5 items-center gap-1.5 text-xs tabular-nums',
        isSaving && 'text-muted-foreground',
        !isSaving && !isError && 'text-muted-foreground',
        isError && 'text-destructive',
        className,
      )}
    >
      {isSaving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {!isSaving && !isError ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : null}
      {isError ? <AlertCircle className="size-3.5" aria-hidden /> : null}
      <span className="truncate">
        {isSaving ? 'Guardando…' : null}
        {isError ? (error ?? 'Error al guardar') : null}
        {!isSaving && !isError && savedAt ? `Guardado ${relative}` : null}
      </span>
    </span>
  )
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

function useRelativeTime(timestamp: number | null): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!timestamp) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 30 * SECOND)
    return () => window.clearInterval(id)
  }, [timestamp])

  if (!timestamp) return ''
  const diff = Math.max(0, now - timestamp)
  if (diff < 5 * SECOND) return 'ahora mismo'
  if (diff < MINUTE) return `hace ${Math.floor(diff / SECOND)} s`
  if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`
  return `hace ${Math.floor(diff / HOUR)} h`
}
