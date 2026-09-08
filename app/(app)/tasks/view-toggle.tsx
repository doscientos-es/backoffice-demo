'use client'

import { LayoutGrid, List, LoaderCircle as Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ButtonGroup } from '@doscientos/ui'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/** Params that are meaningful in both views. */
const SHARED_PARAMS = ['q', 'project', 'priority'] as const
/** Params only meaningful in list view. */
const LIST_ONLY_PARAMS = ['status'] as const

export function TasksViewToggle({ view }: { view: 'board' | 'list' }) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState<'board' | 'list' | null>(null)

  function buildHref(target: 'board' | 'list'): string {
    const next = new URLSearchParams()

    // Preserve filters that work in both views.
    for (const key of SHARED_PARAMS) {
      const v = params.get(key)
      if (v) next.set(key, v)
    }

    // Preserve list-only filters only when staying/switching to list.
    if (target === 'list') {
      for (const key of LIST_ONLY_PARAMS) {
        const v = params.get(key)
        if (v) next.set(key, v)
      }
    }

    if (target === 'board') next.set('view', 'board')

    const qs = next.toString()
    return qs ? `/tasks?${qs}` : '/tasks'
  }

  const navigate = (target: 'board' | 'list') => {
    if (target === view) return
    setPending(target)
    startTransition(() => {
      router.push(buildHref(target))
      setPending(null)
    })
  }

  // Count filters the user has actively set (excluding page / view).
  const activeCount = [...SHARED_PARAMS, ...LIST_ONLY_PARAMS].filter((k) => !!params.get(k)).length

  return (
    <div className="flex items-center gap-2">
      {activeCount > 0 && (
        <Badge
          variant="neutral"
          className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
          title={`${activeCount} filtro${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}`}
        >
          {activeCount}
        </Badge>
      )}
      <ButtonGroup className="border-border bg-muted/30 rounded-lg border">
        <Button
          size="sm"
          variant={view === 'board' ? 'secondary' : 'ghost'}
          className={view !== 'board' ? 'text-muted-foreground hover:text-foreground' : ''}
          disabled={pending !== null}
          onClick={() => navigate('board')}
        >
          {pending === 'board' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <LayoutGrid className="size-3.5" />
          )}
          Tablero
        </Button>
        <Button
          size="sm"
          variant={view === 'list' ? 'secondary' : 'ghost'}
          className={view !== 'list' ? 'text-muted-foreground hover:text-foreground' : ''}
          disabled={pending !== null}
          onClick={() => navigate('list')}
        >
          {pending === 'list' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <List className="size-3.5" />
          )}
          Lista
        </Button>
      </ButtonGroup>
    </div>
  )
}
