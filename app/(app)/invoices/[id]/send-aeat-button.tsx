'use client'

import { Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { MfaChallengeDialog } from '@/components/security/mfa-challenge-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFormFeedback } from '@/components/ui/form-feedback'
import { userVerificationScope } from '@/lib/security/user-verification-scope'
import { grantUserVerificationFromMfa } from '@/lib/security/webauthn-actions'
import {
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
} from '@/lib/security/webauthn-client'

import { sendToAeat } from '../actions'
import { VerifactuIssueDialog } from './verifactu-issue-dialog'

export function SendAeatButton({
  invoiceId,
  disabled,
  isRegularization = false,
  label = 'Enviar a AEAT',
}: {
  invoiceId: string
  disabled?: boolean
  isRegularization?: boolean
  label?: string
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [issue, setIssue] = useState<{ error: string; status: 'error' | 'rejected' } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [mfaOpen, setMfaOpen] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [recentlyVerified, setRecentlyVerified] = useState(false)
  const [passkeyOptions, setPasskeyOptions] = useState<unknown>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const scope = userVerificationScope('invoice.send_aeat', `invoice:${invoiceId}`)

  function showIssue(error: string, status: 'error' | 'rejected' = 'error') {
    setIssue({ error, status })
  }

  async function prepareVerification() {
    setPreparing(true)
    setRecentlyVerified(false)
    setPasskeyOptions(null)
    setVerificationError(null)
    const started = await preparePasskeyAuthentication(scope)
    setPreparing(false)
    if (!started.ok) {
      feedback.setError(started.error)
      setVerificationError(started.error)
      setConfirmOpen(true)
      return
    }
    if (started.verified) {
      setRecentlyVerified(true)
      setConfirmOpen(true)
      return
    }
    setPasskeyOptions(started.options)
    setConfirmOpen(true)
  }

  async function sendVerifiedDelivery() {
    feedback.setPending()
    setConfirmOpen(false)
    const fd = new FormData()
    fd.set('id', invoiceId)
    const result = await sendToAeat(fd)
    if (result.ok) {
      if (result.status === 'accepted') {
        feedback.setSuccess(result.csv ? `Aceptada · CSV ${result.csv}` : 'Aceptada por AEAT')
      } else if (result.status === 'rejected') {
        feedback.setError('AEAT rechazó el registro. Consulta el motivo fiscal antes de continuar.')
        showIssue(
          'AEAT rechazó el registro. Consulta el motivo fiscal antes de continuar.',
          'rejected',
        )
      } else if (result.status === 'error') {
        const detail = result.error ?? 'El envío a AEAT falló; se reintentará automáticamente.'
        feedback.setError(detail)
        showIssue(detail)
      } else if (result.status === 'skipped' || result.status === 'deferred') {
        const detail = result.error ?? 'El registro sigue pendiente de entrega a AEAT.'
        feedback.setError(detail)
        showIssue(detail)
      } else {
        feedback.setSuccess('El registro fiscal ya está siendo gestionado.')
      }
      router.refresh()
    } else {
      feedback.setError(result.error)
      showIssue(result.error)
      router.refresh()
    }
  }

  async function confirmWithPasskey() {
    if (!passkeyOptions) return

    // This browser call must start directly from this click so the device
    // authenticator retains user activation after the server challenge was prepared.
    feedback.setPending()
    const verification = await completePasskeyAuthentication(scope, passkeyOptions)
    if (!verification.ok) {
      feedback.setError(verification.error)
      setVerificationError(verification.error)
      setPasskeyOptions(null)
      return
    }
    setConfirmOpen(false)
    await sendVerifiedDelivery()
  }

  async function confirmWithMfa() {
    feedback.setPending()
    const verification = await grantUserVerificationFromMfa(scope)
    if (!verification.ok) {
      feedback.setError(verification.error)
      setVerificationError(verification.error)
      setMfaOpen(false)
      setConfirmOpen(true)
      return
    }
    setMfaOpen(false)
    await sendVerifiedDelivery()
  }

  return (
    <div className="inline-flex min-w-0">
      <Button
        type="button"
        size="sm"
        variant="default"
        className="justify-center whitespace-nowrap"
        disabled={disabled || preparing || feedback.pending}
        onClick={() => void prepareVerification()}
      >
        <Send className="size-4" />
        {preparing ? 'Preparando…' : feedback.pending ? 'Enviando…' : label}
      </Button>
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) {
            setPasskeyOptions(null)
            setVerificationError(null)
          }
        }}
      >
        <DialogContent showCloseButton={!feedback.pending}>
          <DialogHeader>
            <DialogTitle>
              {isRegularization
                ? 'Confirmar envío de regularización a AEAT'
                : 'Confirmar reenvío a VERI*FACTU'}
            </DialogTitle>
            <DialogDescription>
              {passkeyOptions
                ? 'Usa la biometría o el bloqueo del dispositivo para continuar.'
                : recentlyVerified
                  ? 'Tu identidad ya está verificada. Confirma el envío fiscal para continuar.'
                  : isRegularization
                    ? 'Elige cómo confirmar tu identidad para enviar el registro de subsanación a AEAT.'
                    : 'Elige cómo quieres confirmar tu identidad para reenviar este registro fiscal a AEAT.'}
            </DialogDescription>
          </DialogHeader>
          {verificationError ? (
            <p className="text-destructive text-sm">{verificationError}</p>
          ) : null}
          <DialogFooter>
            {recentlyVerified ? (
              <>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => void sendVerifiedDelivery()}>Confirmar envío</Button>
              </>
            ) : passkeyOptions ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasskeyOptions(null)
                    setVerificationError(null)
                  }}
                  disabled={feedback.pending}
                >
                  Elegir otro método
                </Button>
                <Button onClick={confirmWithPasskey} disabled={feedback.pending}>
                  Confirmar con biometría
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmOpen(false)
                    setMfaOpen(true)
                  }}
                  disabled={preparing || feedback.pending}
                >
                  Usar código de autenticación
                </Button>
                <Button onClick={prepareVerification} disabled={preparing || feedback.pending}>
                  {preparing ? 'Preparando…' : 'Reintentar en este dispositivo'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MfaChallengeDialog
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        onVerified={() => void confirmWithMfa()}
        setupHref="/settings/security"
      />
      {issue ? (
        <VerifactuIssueDialog
          open
          status={issue.status}
          error={issue.error}
          onOpenChange={(open) => !open && setIssue(null)}
        />
      ) : null}
    </div>
  )
}
