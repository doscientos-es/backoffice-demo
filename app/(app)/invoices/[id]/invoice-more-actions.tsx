'use client'

import {
  Button as MenuButton,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@doscientos/ui'
import {
  TriangleAlert as AlertTriangle,
  FileMinus as FileMinus2,
  LoaderCircle as Loader2,
  Ellipsis as MoreHorizontal,
  Trash as Trash2,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useUndoableDelete } from '@/lib/hooks/use-undoable-delete'

import {
  createRectification,
  deleteInvoice,
  markAsUncollectible,
  restoreInvoice,
  updateInvoiceStatus,
} from '../actions'
import type { InvoiceFeedback, VerifyInvoiceStatusChange } from './invoice-action-contracts'

const RECTIFICATION_TYPES = [
  {
    value: 'R1',
    label: 'R1 – Error en datos o devolución',
    description: 'Importe incorrecto, datos erróneos del cliente, devolución parcial o total.',
  },
  {
    value: 'R4',
    label: 'R4 – Otras causas',
    description: 'Cualquier otra corrección no contemplada en R1.',
  },
] as const

function idFormData(invoiceId: string): FormData {
  const formData = new FormData()
  formData.append('id', invoiceId)
  return formData
}

interface Props {
  invoiceId: string
  canCancel: boolean
  canDelete: boolean
  canRectify: boolean
  canMarkUncollectible: boolean
  feedback: InvoiceFeedback
  verifyStatusChange: VerifyInvoiceStatusChange
}

/** Groups destructive and legally exceptional invoice operations behind one menu. */
export function InvoiceMoreActions({
  invoiceId,
  canCancel,
  canDelete,
  canRectify,
  canMarkUncollectible,
  feedback,
  verifyStatusChange,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rectificationOpen, setRectificationOpen] = useState(false)
  const [uncollectibleOpen, setUncollectibleOpen] = useState(false)
  const [rectType, setRectType] = useState<'R1' | 'R4'>('R1')
  const [rectReason, setRectReason] = useState('')
  const { run: deleteInvoiceWithUndo, pending: deletePending } = useUndoableDelete({
    successMessage: 'Factura eliminada',
    onDelete: () => deleteInvoice(idFormData(invoiceId)),
    onRestore: () => restoreInvoice(idFormData(invoiceId)),
    redirectTo: '/invoices',
  })

  if (!(canCancel || canDelete || canRectify || canMarkUncollectible)) return null

  const cancelInvoice = async () => {
    if (!(await verifyStatusChange('cancelled'))) return
    feedback.setPending()
    startTransition(async () => {
      const result = await updateInvoiceStatus({ id: invoiceId, status: 'cancelled' })
      if (result.ok) feedback.setSuccess('Factura anulada')
      else feedback.setError(result.error)
    })
  }

  const markUncollectible = () => {
    startTransition(async () => {
      feedback.setPending()
      const result = await markAsUncollectible({ id: invoiceId })
      setUncollectibleOpen(false)
      if (result.ok) feedback.setSuccess('Factura marcada como incobrable')
      else feedback.setError(result.error)
    })
  }

  const createInvoiceRectification = () => {
    if (!rectReason.trim()) return
    startTransition(async () => {
      feedback.setPending()
      const result = await createRectification({
        originalInvoiceId: invoiceId,
        rectificationType: rectType,
        reason: rectReason.trim(),
      })
      if (!result.ok) {
        feedback.setError(result.error)
        return
      }
      setRectificationOpen(false)
      setRectReason('')
      router.push(`/invoices/${result.id}`)
    })
  }

  return (
    <>
      <DropdownMenuTrigger>
        <MenuButton variant="outline" size="icon" aria-label="Más acciones">
          <MoreHorizontal className="h-4 w-4" />
        </MenuButton>
        <DropdownMenuContent placement="bottom end" className="w-64">
          {canRectify ? (
            <DropdownMenuItem
              className="focus:bg-muted focus:text-foreground data-[highlighted]:bg-muted min-h-9 gap-2 px-2 py-2"
              onAction={() => setRectificationOpen(true)}
            >
              <FileMinus2 className="h-4 w-4" /> Emitir factura rectificativa
            </DropdownMenuItem>
          ) : null}
          {canMarkUncollectible ? (
            <DropdownMenuItem
              className="text-warning focus:bg-warning/10 focus:text-warning data-[highlighted]:bg-warning/10 min-h-9 gap-2 px-2 py-2"
              onAction={() => setUncollectibleOpen(true)}
            >
              <AlertTriangle className="h-4 w-4" /> Marcar como incobrable
            </DropdownMenuItem>
          ) : null}
          {(canRectify || canMarkUncollectible) && (canCancel || canDelete) ? (
            <DropdownMenuSeparator />
          ) : null}
          {canCancel ? (
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 min-h-9 gap-2 px-2 py-2"
              isDisabled={pending}
              onAction={cancelInvoice}
            >
              <XCircle className="h-4 w-4" /> Anular factura
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              {canCancel ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 min-h-9 gap-2 px-2 py-2"
                isDisabled={pending || deletePending}
                onAction={deleteInvoiceWithUndo}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenuTrigger>

      <Dialog open={rectificationOpen} onOpenChange={setRectificationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Factura rectificativa</DialogTitle>
            <DialogDescription>
              Se creará un borrador en serie R con los mismos importes y líneas. Podrás editarlo
              antes de enviarlo a la AEAT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de rectificación</Label>
              {RECTIFICATION_TYPES.map((type) => (
                <label
                  key={type.value}
                  className="has-checked:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3"
                >
                  <input
                    type="radio"
                    name="rectType"
                    value={type.value}
                    checked={rectType === type.value}
                    onChange={() => setRectType(type.value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">{type.label}</span>
                    <span className="text-muted-foreground block text-xs">{type.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rectReason">
                Motivo de la rectificación <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="rectReason"
                className="bg-background focus-visible:ring-ring min-h-20 w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
                placeholder="Describe el motivo de la rectificación (requerido por ley)"
                value={rectReason}
                onChange={(event) => setRectReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setRectificationOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={pending || !rectReason.trim()}
              onClick={createInvoiceRectification}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Crear borrador
              rectificativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uncollectibleOpen} onOpenChange={setUncollectibleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como incobrable</DialogTitle>
            <DialogDescription>
              Esta acción declara el crédito como incobrable según el art. 80.Tres LIVA. Podrás
              recuperar el IVA emitiendo una <strong>factura rectificativa R4</strong>. ¿Confirmar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setUncollectibleOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" disabled={pending} onClick={markUncollectible}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar
              incobrable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
