'use client'

import { CircleCheck as CheckCircle2, LoaderCircle as Loader2, XCircle } from 'lucide-react'
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
import { IconButton } from '@/components/ui/icon-button'
import { Label } from '@/components/ui/label'
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from '@/lib/schemas/invoice'

import { recordInvoicePayment, updateInvoiceStatus } from '../actions'
import type { InvoiceFeedback, VerifyInvoiceStatusChange } from './invoice-action-contracts'

interface Props {
  invoiceId: string
  total: number
  amountPaid: number
  canRecordPayment: boolean
  canRevertPayment: boolean
  feedback: InvoiceFeedback
  verifyStatusChange: VerifyInvoiceStatusChange
  onChanged: () => void
}

/** Isolates payment collection and reversal from fiscal issuance controls. */
export function InvoicePaymentActions({
  invoiceId,
  total,
  amountPaid,
  canRecordPayment,
  canRevertPayment,
  feedback,
  verifyStatusChange,
  onChanged,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [revertOpen, setRevertOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethodType>('transfer')
  const [amount, setAmount] = useState('')

  const openPayment = () => {
    setAmount(Math.max(0, total - amountPaid).toFixed(2))
    setPaymentOpen(true)
  }

  const recordPayment = () => {
    startTransition(async () => {
      feedback.setPending()
      const result = await recordInvoicePayment({
        id: invoiceId,
        amount: Number(amount),
        paymentMethod: method,
      })
      if (!result.ok) {
        feedback.setError(result.error)
        return
      }
      setPaymentOpen(false)
      feedback.setSuccess(result.fullyPaid ? 'Factura pagada' : 'Cobro parcial registrado')
      onChanged()
    })
  }

  const revertPayment = async () => {
    if (!(await verifyStatusChange('issued'))) return
    setRevertOpen(false)
    feedback.setPending()
    startTransition(async () => {
      const result = await updateInvoiceStatus({ id: invoiceId, status: 'issued' })
      if (result.ok) {
        feedback.setSuccess('Factura marcada como no cobrada')
        onChanged()
      } else {
        feedback.setError(result.error)
      }
    })
  }

  return (
    <>
      {canRecordPayment ? (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={openPayment}
            className="text-success-foreground hover:text-success-foreground justify-center whitespace-nowrap"
          >
            <CheckCircle2 className="h-4 w-4" /> Registrar cobro
          </Button>
          <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Registrar cobro</DialogTitle>
                <DialogDescription>
                  Registra el importe recibido. Por defecto se propone todo el pendiente; puedes
                  cambiarlo para pagos a plazos.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="paymentAmount">Importe cobrado (€)</Label>
                <input
                  id="paymentAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                />
                <Label>Medio de cobro</Label>
                <div className="space-y-1.5">
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodType[]).map(
                    (paymentMethod) => (
                      <label
                        key={paymentMethod}
                        className="has-checked:border-primary flex cursor-pointer items-center gap-3 rounded-md border p-3"
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={paymentMethod}
                          checked={method === paymentMethod}
                          onChange={() => setMethod(paymentMethod)}
                        />
                        <span className="text-sm font-medium">
                          {PAYMENT_METHOD_LABELS[paymentMethod]}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setPaymentOpen(false)}
                >
                  Cancelar
                </Button>
                <Button size="sm" disabled={pending} onClick={recordPayment}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Registrar cobro
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {canRevertPayment ? (
        <>
          <IconButton
            variant="outline"
            label="Revertir cobro"
            disabled={pending}
            onClick={() => setRevertOpen(true)}
          >
            <XCircle className="h-4 w-4" />
          </IconButton>
          <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>¿Revertir cobro de la factura?</DialogTitle>
                <DialogDescription>
                  Esto eliminará la fecha de cobro y devolverá la factura al estado{' '}
                  <strong>Emitida</strong>. Úsalo solo para corregir errores.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setRevertOpen(false)}
                >
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" disabled={pending} onClick={revertPayment}>
                  Confirmar reversión
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  )
}
