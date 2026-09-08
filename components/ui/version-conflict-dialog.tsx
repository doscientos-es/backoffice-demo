'use client'

import { TriangleAlert as AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Resolves a stale editor without ever offering a silent overwrite. Closing
 * this dialog preserves the local draft; reloading is an explicit discard.
 */
export function VersionConflictDialog({
  open,
  entityName,
  onKeepEditing,
  onReload,
}: {
  open: boolean
  entityName: string
  onKeepEditing: () => void
  onReload: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onKeepEditing()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-warning size-5" aria-hidden />
            Tus cambios no se han guardado
          </DialogTitle>
          <DialogDescription>
            Otra persona o un proceso actualizó este {entityName} antes de que guardaras. Para
            proteger los datos, no hemos sobrescrito ningún cambio existente.
          </DialogDescription>
        </DialogHeader>
        <div className="border-warning/40 bg-warning/10 text-foreground rounded-md border p-3 text-sm">
          <p className="font-medium">Tu borrador sigue abierto y no se ha perdido.</p>
          <p className="text-muted-foreground mt-1">
            Si recargas, el formulario mostrará los datos actuales y se descartarán solo tus cambios
            locales. Si lo conservas, la base de datos no cambiará y podrás revisarlo o copiarlo
            antes de recargar.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onKeepEditing}>
            Conservar mi borrador
          </Button>
          <Button type="button" onClick={onReload}>
            Recargar datos actuales
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
