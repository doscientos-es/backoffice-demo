'use client'

import { useState } from 'react'

import { beginVaultPasskeyRegistration } from '@/app/(app)/vault/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { registerPasskey } from '@/lib/security/webauthn-client'

/** Enrolls a passkey after re-authenticating with the vault master password. */
export function PasskeyEnrollmentForm({ onClose }: { onClose: () => void }) {
  const feedback = useFormFeedback()
  const [password, setPassword] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [registrationOptions, setRegistrationOptions] = useState<unknown>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPreparing(true)
    const started = await beginVaultPasskeyRegistration({ password })
    setPreparing(false)
    if (!started.ok) {
      feedback.setError(started.error)
      return
    }
    setRegistrationOptions(started.options)
  }

  async function confirmRegistration() {
    if (!registrationOptions) return

    feedback.setPending()
    const result = await registerPasskey(registrationOptions)
    if (!result.ok) {
      feedback.setError(result.error)
      return
    }
    feedback.setSuccess('Biometría activada')
    setTimeout(() => {
      onClose()
      window.location.reload()
    }, 500)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="passkey-password">Contraseña maestra de la bóveda</FieldLabel>
        <Input
          id="passkey-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoFocus
        />
      </Field>
      <p className="text-muted-foreground text-xs">
        No recibimos tu huella, rostro ni PIN: el dispositivo solo confirma tu identidad mediante
        una clave criptográfica.
      </p>
      <div className="border-border flex items-center justify-end gap-2 border-t pt-3">
        <FormFeedback state={feedback.state} successLabel="Activada" />
        <SubmitButton loading={preparing || feedback.pending} pendingLabel="Preparando…">
          Activar
        </SubmitButton>
      </div>
      <Dialog
        open={registrationOptions !== null}
        onOpenChange={(open) => !open && !feedback.pending && setRegistrationOptions(null)}
      >
        <DialogContent showCloseButton={!feedback.pending}>
          <DialogHeader>
            <DialogTitle>Confirmar identidad</DialogTitle>
            <DialogDescription>
              Usa el método de autenticación disponible en este dispositivo para activar la
              biometría.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={feedback.pending}
              onClick={() => setRegistrationOptions(null)}
            >
              Cancelar
            </Button>
            <Button disabled={feedback.pending} onClick={confirmRegistration}>
              Activar con biometría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
