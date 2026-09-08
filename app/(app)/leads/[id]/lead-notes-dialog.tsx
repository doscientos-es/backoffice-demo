'use client'

import { FileText, Maximize2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function LeadNotesDialog({ notes }: { notes: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <Maximize2 className="size-3.5" />
          Ver nota completa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="text-primary size-4" />
            Notas del lead
          </DialogTitle>
          <DialogDescription>
            Información interna completa. El formato original se conserva.
          </DialogDescription>
        </DialogHeader>
        <div className="border-border bg-muted/20 max-h-[60vh] overflow-y-auto rounded-xl border p-4">
          <p className="text-foreground text-sm leading-7 whitespace-pre-wrap">{notes}</p>
        </div>
        <div className="flex justify-end">
          <CopyButton text={notes} label="Copiar notas" className="size-8" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
