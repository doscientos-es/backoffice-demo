'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const DEFAULT_DESCRIPTION = (name: string): ReactNode => (
  <>
    <strong>{name}</strong> ya estaba ganado. ¿Quieres reabrir esta oportunidad como un nuevo ciclo
    de ventas?
  </>
)

export function ReopenConfirmDialog({
  lead,
  onCancel,
  onConfirm,
  title = 'Reabrir oportunidad',
  description = DEFAULT_DESCRIPTION,
  confirmLabel = 'Sí, reabrir',
}: {
  lead: { id: string; name: string } | null
  onCancel: () => void
  onConfirm: () => void
  /** Dialog heading. Defaults to the won-lead reopen copy. */
  title?: string
  /** Body copy, receives the lead name. Defaults to the won-lead reopen copy. */
  description?: (name: string) => ReactNode
  confirmLabel?: string
}) {
  return (
    <Dialog
      open={!!lead}
      onOpenChange={(v) => {
        if (!v) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{lead ? description(lead.name) : null}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
