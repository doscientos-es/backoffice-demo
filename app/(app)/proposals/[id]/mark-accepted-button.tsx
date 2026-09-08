'use client'

import { CheckCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ChangeEvent, useState, useTransition } from 'react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { markProposalAsAccepted } from '../actions'

/**
 * Lets team members mark a proposal as accepted manually — for cases where
 * the client accepted in person or by phone without going through the portal.
 */
type FiscalForm = {
  name: string
  nif: string
  billing_address: string
  contact_person: string
  email: string
  phone: string
}

export function MarkAcceptedButton({
  proposalId,
  needsFiscal,
  fiscalPrefill,
  alreadyAccepted = false,
}: {
  proposalId: string
  needsFiscal: boolean
  fiscalPrefill: FiscalForm
  alreadyAccepted?: boolean
}) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 3000 })
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [fiscal, setFiscal] = useState(fiscalPrefill)

  const patchFiscal = (field: keyof FiscalForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setFiscal((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleConfirm = () => {
    if (
      needsFiscal &&
      (!fiscal.name.trim() || !fiscal.nif.trim() || !fiscal.billing_address.trim())
    ) {
      feedback.setError('Completa razón social, NIF y dirección de facturación')
      return
    }
    feedback.setPending()
    startTransition(async () => {
      const res = await markProposalAsAccepted({
        id: proposalId,
        fiscal: needsFiscal
          ? {
              name: fiscal.name.trim(),
              nif: fiscal.nif.trim(),
              billing_address: fiscal.billing_address.trim(),
              contact_person: fiscal.contact_person.trim() || undefined,
              email: fiscal.email.trim() || undefined,
              phone: fiscal.phone.trim() || undefined,
            }
          : undefined,
      })
      if (!res.ok) {
        feedback.setError(res.error)
        return
      }
      feedback.setSuccess(alreadyAccepted ? 'Datos fiscales completados' : 'Propuesta aceptada')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckCheck aria-hidden />
          {alreadyAccepted ? 'Completar datos fiscales' : 'Marcar como aceptada'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {alreadyAccepted ? 'Completar datos fiscales' : 'Marcar como aceptada'}
          </DialogTitle>
          <DialogDescription>
            {alreadyAccepted
              ? 'Crea la ficha fiscal necesaria para preparar las facturas de esta propuesta.'
              : 'Confirma que se ha aceptado fuera del portal. La propuesta quedará bloqueada y se prepararán sus facturas.'}
          </DialogDescription>
        </DialogHeader>
        {needsFiscal ? (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-sm">
              Necesitamos estos datos para crear automáticamente la ficha fiscal y poder facturar.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="manual-fiscal-name">Razón social</Label>
              <Input
                id="manual-fiscal-name"
                value={fiscal.name}
                onChange={patchFiscal('name')}
                disabled={pending}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="manual-fiscal-nif">NIF</Label>
                <Input
                  id="manual-fiscal-nif"
                  value={fiscal.nif}
                  onChange={patchFiscal('nif')}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manual-fiscal-contact">Persona de contacto</Label>
                <Input
                  id="manual-fiscal-contact"
                  value={fiscal.contact_person}
                  onChange={patchFiscal('contact_person')}
                  disabled={pending}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-fiscal-address">Dirección de facturación</Label>
              <Input
                id="manual-fiscal-address"
                value={fiscal.billing_address}
                onChange={patchFiscal('billing_address')}
                disabled={pending}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="manual-fiscal-email">Email</Label>
                <Input
                  id="manual-fiscal-email"
                  type="email"
                  value={fiscal.email}
                  onChange={patchFiscal('email')}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manual-fiscal-phone">Teléfono</Label>
                <Input
                  id="manual-fiscal-phone"
                  value={fiscal.phone}
                  onChange={patchFiscal('phone')}
                  disabled={pending}
                />
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter className="flex items-center gap-2">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={pending}>
            {pending
              ? 'Guardando…'
              : alreadyAccepted
                ? 'Guardar datos fiscales'
                : 'Confirmar aceptación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
