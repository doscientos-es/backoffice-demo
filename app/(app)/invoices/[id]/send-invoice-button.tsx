'use client'

import { Mail } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { sendInvoiceEmail } from '../actions'

/**
 * Opens a dialog to email the public portal link of an invoice to the client,
 * with an optional recipient override and a custom message. Shown only for
 * issued invoices (the server action also re-validates this).
 */
export function SendInvoiceButton({
  invoiceId,
  defaultEmail,
  iconOnly = false,
}: {
  invoiceId: string
  defaultEmail?: string | null
  /** Render the trigger as a square icon-only button (no label text). */
  iconOnly?: boolean
}) {
  const feedback = useFormFeedback()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')

  async function onSend() {
    feedback.setPending()
    const result = await sendInvoiceEmail({
      id: invoiceId,
      to: to.trim() || undefined,
      message: message.trim() || undefined,
    })
    if (result.ok) {
      feedback.setSuccess(result.mocked ? 'Email simulado (sin Resend)' : 'Email enviado')
      setTimeout(() => setOpen(false), 1200)
    } else {
      feedback.setError(result.error)
    }
  }

  return (
    <>
      {iconOnly ? (
        <IconButton variant="outline" label="Enviar email al cliente" onClick={() => setOpen(true)}>
          <Mail className="h-4 w-4" />
        </IconButton>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Mail className="mr-2 h-4 w-4" />
          Enviar email
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar factura al cliente</DialogTitle>
            <DialogDescription>
              Se enviará un email con un botón «Ver y pagar» que abre el portal del cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-email-to">Destinatario</Label>
              <Input
                id="invoice-email-to"
                type="email"
                placeholder={defaultEmail ?? 'email@cliente.com'}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Déjalo vacío para usar el email del cliente.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-email-message">Mensaje (opcional)</Label>
              <Textarea
                id="invoice-email-message"
                rows={3}
                placeholder="Añade una nota personal para el cliente…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="items-center sm:justify-between">
            <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={feedback.pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" disabled={feedback.pending} onClick={onSend}>
                <Mail className="mr-2 h-4 w-4" />
                {feedback.pending ? 'Enviando…' : 'Enviar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
