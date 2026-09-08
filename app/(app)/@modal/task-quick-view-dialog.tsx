'use client'

import { ArrowUpRight, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function TaskQuickViewDialog({ taskId, children }: { taskId: string; children: ReactNode }) {
  const router = useRouter()

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        showCloseButton={false}
        className="h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:h-[min(92dvh,56rem)] sm:max-w-6xl"
      >
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <DialogTitle>Detalle de tarea</DialogTitle>
            <DialogDescription>
              Consulta y actualiza la tarea sin salir de esta página.
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/tasks/${taskId}`}>
                <span className="hidden sm:inline">Abrir página completa</span>
                <span className="sm:hidden">Abrir</span>
                <ArrowUpRight />
              </a>
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Cerrar detalle de tarea">
                <X />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
