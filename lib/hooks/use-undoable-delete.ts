'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { sileo } from 'sileo'

type ActionResult = { ok: true } | { ok: false; error: string }

interface UseUndoableDeleteOptions {
  /** Toast text shown after a successful delete, e.g. "Cliente eliminado". */
  successMessage: string
  /** Performs the soft-delete. Should set `deleted_at`. */
  onDelete: () => Promise<ActionResult>
  /** Restores the record (clears `deleted_at`). Bound to the same id. */
  onRestore: () => Promise<ActionResult>
  /** Optional route to navigate to after deleting (detail pages). */
  redirectTo?: string
}

/**
 * Optimistic soft-delete with an "undo" affordance, per the product spec
 * (§29.6): the record disappears immediately and a 5s toast offers a
 * "Deshacer" action that restores it. The `sileo` `<Toaster>` lives at the
 * app layout root, so the toast survives the client-side navigation that a
 * detail-page delete triggers.
 */
export function useUndoableDelete({
  successMessage,
  onDelete,
  onRestore,
  redirectTo,
}: UseUndoableDeleteOptions) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const run = () => {
    startTransition(async () => {
      const res = await onDelete()
      if (!res.ok) {
        sileo.error({ title: res.error })
        return
      }

      if (redirectTo) router.push(redirectTo)
      router.refresh()

      sileo.success({
        title: successMessage,
        duration: 5000,
        button: {
          title: 'Deshacer',
          onClick: () =>
            startTransition(async () => {
              const restored = await onRestore()
              if (restored.ok) router.refresh()
              else sileo.error({ title: restored.error })
            }),
        },
      })
    })
  }

  return { run, pending }
}
