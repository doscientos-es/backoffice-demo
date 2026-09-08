'use client'

import { useOptimistic, useTransition } from 'react'

import type { ActionResult } from '../lib/types'

interface RemoveOptions {
  /** Runs once the server action settles (success or failure). */
  onSettled?: () => void
  /** Overrides the error message passed to `onError`. */
  errorMessage?: string
}

/**
 * Optimistic removal for list/board contexts. The item disappears from the UI
 * immediately; while the server action is in flight `useOptimistic` keeps it
 * hidden. On success, server revalidation drops it from the source `items`, so
 * it stays gone. On failure, React reverts the optimistic state (the row
 * reappears) and `onError` is called.
 *
 * The source `items` MUST come from the server (props) so revalidation can win
 * the race against the reverting transition.
 *
 * @param items    Server-authoritative list of items.
 * @param onError  Optional callback fired when the action fails (e.g. to show a toast).
 */
export function useOptimisticRemoval<T extends { id: string }>(
  items: T[],
  onError?: (message: string) => void,
) {
  const [optimisticItems, dropOptimistic] = useOptimistic(items, (state, id: string) =>
    state.filter((it) => it.id !== id),
  )
  const [pending, startTransition] = useTransition()

  const remove = (id: string, action: () => Promise<ActionResult>, options?: RemoveOptions) => {
    startTransition(async () => {
      dropOptimistic(id)
      const res = await action()
      if (!res.ok) onError?.(options?.errorMessage ?? res.error)
      options?.onSettled?.()
    })
  }

  return { items: optimisticItems, remove, pending }
}
