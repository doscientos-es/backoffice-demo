'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { acceptProposal, rejectProposal } from './actions'

type FiscalForm = {
  name: string
  nif: string
  billing_address: string
  contact_person: string
  email: string
  phone: string
}

type Props = {
  token: string
  /** When true, the visitor must provide fiscal data before accepting. */
  needsFiscal: boolean
  /** Best-effort prefill of the fiscal form from lead/client info. */
  fiscalPrefill: FiscalForm
}

export function ProposalActions({ token, needsFiscal, fiscalPrefill }: Props) {
  const feedback = useFormFeedback({ successResetMs: 0 })
  const [showReject, setShowReject] = useState(false)
  const [showAccept, setShowAccept] = useState(false)
  const [reason, setReason] = useState('')
  const [fiscal, setFiscal] = useState<FiscalForm>(fiscalPrefill)

  const onAcceptDirect = async () => {
    feedback.setPending()
    const res = await acceptProposal(token)
    if (res.ok) feedback.setSuccess('Propuesta aceptada. Gracias.')
    else feedback.setError(res.error)
  }

  const onAcceptWithFiscal = async () => {
    if (!fiscal.name.trim() || !fiscal.nif.trim() || !fiscal.billing_address.trim()) {
      feedback.setError('Completa razón social, NIF y dirección de facturación')
      return
    }
    feedback.setPending()
    const res = await acceptProposal(token, {
      name: fiscal.name.trim(),
      nif: fiscal.nif.trim(),
      billing_address: fiscal.billing_address.trim(),
      contact_person: fiscal.contact_person.trim() || undefined,
      email: fiscal.email.trim() || undefined,
      phone: fiscal.phone.trim() || undefined,
    })
    if (res.ok) feedback.setSuccess('Propuesta aceptada. Gracias.')
    else feedback.setError(res.error)
  }

  const onReject = async () => {
    feedback.setPending()
    const res = await rejectProposal(token, reason.trim() || undefined)
    if (res.ok) feedback.setSuccess('Respuesta registrada.')
    else feedback.setError(res.error)
  }

  const patch = (k: keyof FiscalForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFiscal((prev) => ({ ...prev, [k]: e.target.value }))

  if (showAccept && needsFiscal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Datos de facturación</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Necesitamos tus datos fiscales para emitir la factura al aceptar la propuesta.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="fiscal-name">Razón social *</Label>
              <Input
                id="fiscal-name"
                value={fiscal.name}
                onChange={patch('name')}
                disabled={feedback.pending}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal-nif">NIF / CIF *</Label>
              <Input
                id="fiscal-nif"
                value={fiscal.nif}
                onChange={patch('nif')}
                disabled={feedback.pending}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal-contact">Persona de contacto</Label>
              <Input
                id="fiscal-contact"
                value={fiscal.contact_person}
                onChange={patch('contact_person')}
                disabled={feedback.pending}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="fiscal-address">Dirección de facturación *</Label>
              <Input
                id="fiscal-address"
                value={fiscal.billing_address}
                onChange={patch('billing_address')}
                disabled={feedback.pending}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal-email">Email</Label>
              <Input
                id="fiscal-email"
                type="email"
                value={fiscal.email}
                onChange={patch('email')}
                disabled={feedback.pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fiscal-phone">Teléfono</Label>
              <Input
                id="fiscal-phone"
                value={fiscal.phone}
                onChange={patch('phone')}
                disabled={feedback.pending}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <FormFeedback state={feedback.state} pendingLabel="Procesando…" />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowAccept(false)}
              disabled={feedback.pending}
            >
              Cancelar
            </Button>
            <Button className="w-full" onClick={onAcceptWithFiscal} disabled={feedback.pending}>
              {feedback.pending ? 'Procesando…' : 'Confirmar y aceptar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (showReject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rechazar propuesta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cuéntanos qué podemos mejorar"
              rows={4}
              maxLength={500}
              disabled={feedback.pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowReject(false)}
              disabled={feedback.pending}
            >
              Cancelar
            </Button>
            <Button
              className="w-full"
              variant="destructive"
              onClick={onReject}
              disabled={feedback.pending}
            >
              {feedback.pending ? 'Enviando…' : 'Confirmar rechazo'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu respuesta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Acepta o rechaza esta propuesta. Esta acción es definitiva.
        </p>
        <div className="flex flex-col gap-2">
          <FormFeedback state={feedback.state} pendingLabel="Procesando…" />
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setShowReject(true)}
            disabled={feedback.pending}
          >
            Rechazar
          </Button>
          <Button
            className="w-full"
            onClick={needsFiscal ? () => setShowAccept(true) : onAcceptDirect}
            disabled={feedback.pending}
          >
            {feedback.pending ? 'Procesando…' : 'Aceptar propuesta'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
