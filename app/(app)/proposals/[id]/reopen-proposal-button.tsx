'use client'

import { TriangleAlert as AlertTriangle, Undo2 as RotateCcw } from 'lucide-react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'

import { reopenProposal } from '../actions'

/**
 * Lets owners/admins reopen an accepted or rejected proposal so adjustments
 * can be made (e.g. a discount agreed in a follow-up meeting) before
 * resending it for re-acceptance.
 */
export function ReopenProposalButton({ proposalId }: { proposalId: string }) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 3000 })
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    feedback.setPending()
    startTransition(async () => {
      const res = await reopenProposal({ id: proposalId })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess('Propuesta reabierta')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw aria-hidden /> Reabrir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            Reabrir propuesta
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="block">
              Esto revertirá el estado a <strong>Enviada</strong> y borrará la firma o respuesta del
              cliente, permitiéndote modificar precio, condiciones o cualquier campo.
            </span>
            <span className="block text-amber-700 dark:text-amber-400">
              El cliente tendrá que volver a aceptar la propuesta modificada para que surta efecto.
              Si ya se generó una factura, modifícala directamente — no vuelvas a facturar desde
              esta propuesta.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex items-center gap-2">
          <FormFeedback state={feedback.state} pendingLabel="Reabriendo…" />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="outline" size="sm" onClick={handleConfirm} disabled={pending}>
            {pending ? 'Reabriendo…' : 'Confirmar reapertura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
