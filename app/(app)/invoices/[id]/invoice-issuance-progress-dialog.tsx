'use client'

import {
  CircleCheck as CheckCircle2,
  Circle,
  Clock as Clock3,
  File as FileCheck2,
  LoaderCircle as Loader2,
  TriangleAlert,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type InvoiceIssuancePhase =
  | 'verifying'
  | 'processing'
  | 'accepted'
  | 'deferred'
  | 'delivery_error'
  | 'rejected'
  | 'error'

type StepState = 'active' | 'complete' | 'error' | 'pending' | 'warning'

type Step = { title: string; detail: string; state: StepState }

function stepStyle(state: StepState) {
  if (state === 'complete')
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (state === 'active') return 'border-primary/30 bg-primary/10 text-primary'
  if (state === 'warning')
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  if (state === 'error') return 'border-destructive/30 bg-destructive/10 text-destructive'
  return 'border-border bg-muted/50 text-muted-foreground'
}

function stepsFor(phase: InvoiceIssuancePhase, error: string | null): Step[] {
  const completed = ['accepted', 'deferred', 'delivery_error', 'rejected'].includes(phase)
  const failedBeforeIssue = phase === 'error'
  const qrSynced = phase === 'accepted'
  return [
    {
      title: 'Confirmación de seguridad',
      detail:
        phase === 'verifying'
          ? 'Solicitando confirmación con tu passkey'
          : 'Acción sensible autorizada',
      state: phase === 'verifying' ? 'active' : failedBeforeIssue ? 'error' : 'complete',
    },
    {
      title: 'Registro fiscal inmutable',
      detail: failedBeforeIssue
        ? (error ?? 'No se pudo confirmar el registro fiscal')
        : phase === 'processing'
          ? 'Validando el SIF y creando la evidencia durable'
          : 'Registro y encadenamiento SHA-256 creados',
      state:
        phase === 'processing'
          ? 'active'
          : failedBeforeIssue
            ? 'error'
            : completed
              ? 'complete'
              : 'pending',
    },
    {
      title: 'Código QR verificable',
      detail: qrSynced
        ? 'QR fiscal sincronizado con el RegistroAlta'
        : 'Solo se sincroniza tras la aceptación de AEAT',
      state: qrSynced ? 'complete' : 'pending',
    },
    {
      title: 'Entrega inicial a AEAT',
      detail:
        phase === 'accepted'
          ? 'Registro aceptado por AEAT'
          : phase === 'deferred'
            ? 'En cola: se reintentará respetando el control de flujo'
            : phase === 'delivery_error'
              ? 'Error técnico registrado; consulta el estado antes de reintentar'
              : phase === 'rejected'
                ? 'AEAT rechazó el registro; revisa el motivo antes de continuar'
                : phase === 'processing'
                  ? 'Enviando o dejando la entrega preparada en la cola durable'
                  : 'Pendiente hasta que el registro fiscal esté creado',
      state:
        phase === 'accepted'
          ? 'complete'
          : phase === 'deferred'
            ? 'warning'
            : phase === 'delivery_error'
              ? 'warning'
              : phase === 'rejected'
                ? 'error'
                : phase === 'processing'
                  ? 'active'
                  : 'pending',
    },
  ]
}

export function InvoiceIssuanceProgressDialog({
  open,
  phase,
  error,
  csv,
  onClose,
}: {
  open: boolean
  phase: InvoiceIssuancePhase
  error: string | null
  csv: string | null
  onClose: () => void
}) {
  const steps = stepsFor(phase, error)
  const busy = phase === 'verifying' || phase === 'processing'
  const complete = steps.filter((step) => step.state === 'complete').length
  const title = phase === 'accepted' ? 'Factura emitida y aceptada' : 'Emitiendo factura'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="gap-5 sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {phase === 'accepted' ? <FileCheck2 className="size-5 text-emerald-600" /> : null}
            {phase === 'rejected' || phase === 'error' ? (
              <TriangleAlert className="text-destructive size-5" />
            ) : null}
            {busy ? <Loader2 className="text-primary size-5 animate-spin" /> : null}
            {title}
          </DialogTitle>
          <DialogDescription>
            La factura no se considera emitida hasta que se complete el registro fiscal durable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="Progreso de emisión fiscal"
            aria-valuemax={4}
            aria-valuemin={0}
            aria-valuenow={complete}
          >
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${(complete / 4) * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground text-right text-xs tabular-nums">
            {complete} de 4 comprobaciones completadas
          </p>
        </div>

        <ol className="space-y-2">
          {steps.map((step) => {
            const Icon =
              step.state === 'active'
                ? Loader2
                : step.state === 'complete'
                  ? CheckCircle2
                  : step.state === 'error'
                    ? XCircle
                    : step.state === 'warning'
                      ? Clock3
                      : Circle
            return (
              <li
                key={step.title}
                className={cn(
                  'flex gap-3 rounded-xl border p-3 transition-colors',
                  stepStyle(step.state),
                )}
              >
                <Icon
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    step.state === 'active' && 'animate-spin',
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs opacity-80">{step.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>

        {csv ? (
          <p className="bg-muted rounded-md px-3 py-2 font-mono text-xs">CSV AEAT · {csv}</p>
        ) : null}

        {!busy ? (
          <DialogFooter>
            <Button size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
