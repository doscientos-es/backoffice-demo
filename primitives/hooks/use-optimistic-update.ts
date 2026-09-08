'use client'

import { useState, useTransition } from 'react'

import type { ActionResult } from '../lib/types'

/**
 * Optimistic scalar-field update hook.
 *
 * `value` reflects the new state immediately. If the server action returns
 * `{ ok: false }` the previous value is restored and `onError` is called.
 *
 * @param initial  The server-authoritative initial value.
 * @param onError  Optional callback fired when the action fails (e.g. to show a toast).
 *
 * @example
 * const { value, commit } = useOptimisticUpdate(serverStatus, (msg) => toast.error(msg));
 * commit(next, () => updateStatus({ id, status: next }));
 */
export function useOptimisticUpdate<T>(initial: T, onError?: (message: string) => void) {
  const [value, setValue] = useState<T>(initial)
  const [, startTransition] = useTransition()

  const commit = (next: T, action: () => Promise<ActionResult | undefined>) => {
    const prev = value
    setValue(next) // optimistic
    startTransition(async () => {
      const res = await action()
      if (res && !res.ok) {
        setValue(prev) // revert
        onError?.(res.error)
      }
    })
  }

  return { value, commit }
}
