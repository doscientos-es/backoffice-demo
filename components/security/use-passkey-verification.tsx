'use client'

import { Fingerprint, LoaderCircle, ShieldCheck } from 'lucide-react'
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
import type { UserVerificationScope } from '@/lib/security/user-verification-scope'
import {
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
} from '@/lib/security/webauthn-client'

type VerificationResult = { ok: true } | { ok: false; error: string }
type PendingVerification = {
  options: unknown
  resolve: (result: VerificationResult) => void
  scope: UserVerificationScope
}

/**
 * Prepares a server challenge, then starts the device authenticator from an
 * explicit second click so browsers retain the required user activation.
 */
export function usePasskeyVerification() {
  const [pending, setPending] = useState<PendingVerification | null>(null)
  const [completing, setCompleting] = useState(false)

  async function verifyWithPasskey(scope: UserVerificationScope): Promise<VerificationResult> {
    const started = await preparePasskeyAuthentication(scope)
    if (!started.ok) return started
    if (started.verified) return { ok: true }

    return new Promise((resolve) => {
      setPending({ options: started.options, resolve, scope })
    })
  }

  async function confirm() {
    if (!pending) return

    setCompleting(true)
    const verification = await completePasskeyAuthentication(pending.scope, pending.options)
    setCompleting(false)
    setPending(null)
    pending.resolve(verification)
  }

  function close() {
    if (!pending || completing) return
    const { resolve } = pending
    setPending(null)
    resolve({ ok: false, error: 'La verificación se ha cancelado' })
  }

  const challenge = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={!completing}>
        <DialogHeader>
          <div className="bg-primary/10 text-primary mb-1 flex size-10 items-center justify-center rounded-full">
            <Fingerprint className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle>Confirma esta acción sensible</DialogTitle>
          <DialogDescription>
            Usa la biometría, el PIN o el bloqueo de este dispositivo para continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/40 text-muted-foreground flex gap-3 rounded-lg border p-3 text-sm">
          <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Después no volveremos a pedírtelo durante 15 minutos en este dispositivo.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={completing} onClick={close}>
            Cancelar
          </Button>
          <Button disabled={completing} onClick={confirm}>
            {completing ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Fingerprint className="size-4" aria-hidden="true" />
            )}
            {completing ? 'Verificando…' : 'Confirmar en este dispositivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { challenge, verifyWithPasskey }
}
