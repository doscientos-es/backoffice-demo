'use client'

import { FileText } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function QuotedSuggestionDialog({
  lead,
  onClose,
}: {
  lead: { id: string; name: string } | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={!!lead}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Lead movido a Presupuestado</DialogTitle>
          <DialogDescription>
            ¿Quieres crear una propuesta para <strong>{lead?.name}</strong> ahora?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Ahora no
          </Button>
          <Button asChild size="sm" onClick={onClose}>
            <Link href={`/proposals/new?lead_id=${lead?.id ?? ''}`}>
              <FileText className="size-3.5" />
              Crear propuesta
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
