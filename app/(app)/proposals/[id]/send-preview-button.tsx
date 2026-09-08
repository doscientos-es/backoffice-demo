'use client'

import { CheckCheck, LoaderCircle as Loader2, Send } from 'lucide-react'
import { type FormEvent, useState, useTransition } from 'react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { markProposalAsSent, previewProposalEmail, sendPreviewLink } from '../actions'

type Props = {
  id: string
  defaultEmail: string | null
  alreadySent: boolean
}

/**
 * Lets the team review the exact rendered email and its recipient before the
 * public proposal URL is delivered.
 */
export function SendPreviewButton({ id, defaultEmail, alreadySent }: Props) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultEmail ?? '')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewMessage, setPreviewMessage] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const feedback = useFormFeedback({ successResetMs: 4000 })
  const markFeedback = useFormFeedback({ successResetMs: 4000 })
  const [pending, startTransition] = useTransition()
  const [markPending, startMarkTransition] = useTransition()

  const loadPreview = async () => {
    setLoadingPreview(true)
    const messageForPreview = message.trim()
    const res = await previewProposalEmail({
      id,
      message: messageForPreview || undefined,
    })
    if (res.ok) {
      setPreview({ subject: res.subject, html: res.html })
      setPreviewMessage(message)
    } else {
      feedback.setError(res.error)
    }
    setLoadingPreview(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) void loadPreview()
  }

  const handleMarkAsSent = () => {
    markFeedback.setPending()
    startMarkTransition(async () => {
      const res = await markProposalAsSent({ id })
      if (!res.ok) {
        markFeedback.setError(res.error)
      } else {
        markFeedback.setSuccess('Marcada como enviada')
      }
    })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!preview || previewMessage !== message) {
      feedback.setError('Actualiza la vista previa antes de enviar el email.')
      return
    }
    feedback.setPending()
    startTransition(async () => {
      const res = await sendPreviewLink({
        id,
        to: to.trim() || undefined,
        message: message.trim() || undefined,
      })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess(res.mocked ? 'Email simulado (modo dev)' : 'Email enviado')
      setOpen(false)
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <FormFeedback state={markFeedback.state} pendingLabel="Guardando…" />
        <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
        {!alreadySent && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleMarkAsSent}
            disabled={markPending || pending}
          >
            <CheckCheck aria-hidden /> Marcar como enviada
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => onOpenChange(true)}
          disabled={pending || markPending}
        >
          <Send aria-hidden /> {alreadySent ? 'Reenviar preview' : 'Enviar preview al cliente'}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Revisar email antes de enviarlo</DialogTitle>
            <DialogDescription>
              Comprueba el destinatario y el contenido exacto que recibirá el cliente.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preview-to">Email del cliente</Label>
                <Input
                  id="preview-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  required
                  autoComplete="email"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preview-message">Mensaje adicional (opcional)</Label>
                <Textarea
                  id="preview-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="Te dejo el enlace para que revises la propuesta…"
                  disabled={pending}
                />
                {previewMessage !== message ? (
                  <p className="text-xs text-amber-700">
                    Actualiza la vista previa para incluir el mensaje.
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadPreview()}
                disabled={loadingPreview || pending}
              >
                {loadingPreview ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Actualizar vista previa
              </Button>
            </div>
            <div className="border-border bg-muted/30 overflow-hidden rounded-lg border">
              <div className="bg-background border-b px-4 py-3">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Asunto
                </p>
                <p className="mt-1 text-sm font-medium">{preview?.subject ?? 'Cargando email…'}</p>
              </div>
              <div className="h-105 bg-white">
                {loadingPreview ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    <Loader2 className="animate-spin" aria-label="Cargando vista previa" />
                  </div>
                ) : preview ? (
                  <iframe
                    title="Vista previa del email"
                    srcDoc={preview.html}
                    sandbox=""
                    className="h-full w-full border-0"
                  />
                ) : (
                  <p className="text-muted-foreground p-4 text-sm">
                    No se pudo cargar la vista previa.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="lg:col-span-2">
              <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={pending || loadingPreview || !preview || previewMessage !== message}
              >
                <Send aria-hidden /> {pending ? 'Enviando…' : 'Enviar email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
