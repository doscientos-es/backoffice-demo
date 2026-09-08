'use client'

import { TriangleAlert as AlertTriangle, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AEAT_VERIFACTU_ERROR_CATALOG_URL, getAeatErrorMetadata } from '@/lib/verifactu/aeat-errors'

type VerifactuIssueStatus = 'error' | 'rejected'

const issueCopy = {
  error: {
    title: 'Error técnico de VERI*FACTU',
    trigger: 'Ver detalle',
    guidance:
      'Los fallos temporales se reintentan automáticamente. Si el detalle indica un error definitivo, corrige la causa y usa «Regularizar y enviar».',
  },
  rejected: {
    title: 'Factura rechazada por AEAT',
    trigger: 'Ver detalle',
    guidance:
      'Revisa el motivo fiscal antes de volver a enviar el registro o aplicar el procedimiento correspondiente.',
  },
} as const

export function VerifactuIssueDialog({
  status,
  error,
  aeatCode,
  open,
  onOpenChange,
}: {
  status: VerifactuIssueStatus
  error: string | null
  aeatCode?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <VerifactuIssueDialogContent status={status} error={error} aeatCode={aeatCode} />
    </Dialog>
  )
}

export function VerifactuIssueDetailsButton({
  status,
  error,
  aeatCode,
}: {
  status: VerifactuIssueStatus
  error: string | null
  aeatCode?: string | null
}) {
  const copy = issueCopy[status]

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant="destructive"
          className="max-w-full"
          aria-label={`Ver detalle de ${copy.title}`}
        >
          <AlertTriangle className="size-3" aria-hidden />
          <span className="truncate">{copy.trigger}</span>
        </Button>
      </DialogTrigger>
      <VerifactuIssueDialogContent status={status} error={error} aeatCode={aeatCode} />
    </Dialog>
  )
}

function VerifactuIssueDialogContent({
  status,
  error,
  aeatCode,
}: {
  status: VerifactuIssueStatus
  error: string | null
  aeatCode?: string | null
}) {
  const copy = issueCopy[status]
  const officialMetadata = getAeatErrorMetadata(aeatCode, error)

  return (
    <DialogContent className="min-w-0 sm:max-w-lg">
      <DialogHeader className="min-w-0">
        <DialogTitle className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="text-destructive size-5 shrink-0" aria-hidden />
          <span className="truncate">{copy.title}</span>
        </DialogTitle>
        <DialogDescription>{copy.guidance}</DialogDescription>
      </DialogHeader>

      {officialMetadata ? (
        <div className="bg-muted/40 space-y-1.5 rounded-md border p-3 text-sm">
          <p className="font-medium">Código AEAT {officialMetadata.code}</p>
          <p className="text-muted-foreground">{officialMetadata.effectLabel}</p>
          <a
            href={AEAT_VERIFACTU_ERROR_CATALOG_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
          >
            Consultar definición en el catálogo oficial de AEAT
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      ) : null}

      {error ? (
        <div className="min-w-0 space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">Detalle técnico</p>
          <pre className="bg-muted text-foreground max-h-56 overflow-auto rounded-md p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button size="sm" variant="outline">
            Cerrar
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  )
}
