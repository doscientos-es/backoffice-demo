'use client'

import { Check } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/**
 * Purely presentational button — the parent (RemindersSection) owns the
 * optimistic state and wires the server action via `onCompleteAction`. Asks
 * for confirmation first so an accidental click doesn't silently complete the
 * reminder.
 */
export function ReminderCompleteButton({
  id,
  onCompleteAction,
}: {
  id: string
  onCompleteAction: (id: string) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Marcar como completado"
        title="Marcar como completado"
        onClick={() => setConfirmOpen(true)}
      >
        <Check className="size-3" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Marcar aviso como completado?"
        description="El aviso desaparecerá de la lista de pendientes."
        confirmLabel="Sí, completar"
        onConfirm={() => {
          setConfirmOpen(false)
          onCompleteAction(id)
        }}
      />
    </>
  )
}
