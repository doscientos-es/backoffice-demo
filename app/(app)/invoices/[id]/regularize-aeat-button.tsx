'use client'

import {
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2,
  LoaderCircle as Loader2,
  Undo2 as RotateCcw,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { userVerificationScope } from '@/lib/security/user-verification-scope'
import {
  completePasskeyAuthentication,
  preparePasskeyAuthentication,
} from '@/lib/security/webauthn-client'

import { regularizeVerifactu } from '../actions'

/**
 * Recovery action for an AEAT-rejected record. It deliberately asks for
 * confirmation because it appends a new immutable fiscal record.
 */
export function RegularizeAeatButton({
  invoiceId,
  recipientFiscalReady = true,
}: {
  invoiceId: string
  recipientFiscalReady?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<'confirm' | 'verifying' | 'sending' | 'success' | 'error'>(
    'confirm',
  )
  const [message, setMessage] = useState<string | null>(null)
  const [csv, setCsv] = useState<string | null>(null)
  const [passkeyOptions, setPasskeyOptions] = useState<unknown>(null)
  const scope = userVerificationScope('invoice.verifactu_regularize', `invoice:${invoiceId}`)
  function openConfirmation() {
    setPhase('confirm')
    setMessage(null)
    setCsv(null)
    setPasskeyOptions(null)
    setOpen(true)
  }

  async function sendRegularization() {
    setPhase('sending')
    const fd = new FormData()
    fd.set('id', invoiceId)
    const result = await regularizeVerifactu(fd)
    if (result.ok) {
      if (result.status === 'accepted') {
        setPhase('success')
        setCsv(result.csv)
        setMessage('La factura ha quedado aceptada por AEAT y la cadena puede continuar.')
      } else {
        setPhase('error')
        setMessage(result.error ?? 'La regularización quedó pendiente de envío.')
      }
    } else {
      setPhase('error')
      setMessage(result.error)
    }
    router.refresh()
  }

  async function prepareVerification() {
    setPhase('verifying')
    setMessage(null)
    setCsv(null)
    const started = await preparePasskeyAuthentication(scope)
    if (!started.ok) {
      setPhase('error')
      setMessage(started.error)
      return
    }
    if (started.verified) {
      await sendRegularization()
      return
    }
    setPasskeyOptions(started.options)
    setPhase('confirm')
  }

  async function confirmWithPasskey() {
    if (!passkeyOptions) return

    setPhase('verifying')
    const verification = await completePasskeyAuthentication(scope, passkeyOptions)
    if (!verification.ok) {
      setPhase('error')
      setMessage(verification.error)
      return
    }
    await sendRegularization()
  }

  const busy = phase === 'verifying' || phase === 'sending'

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="justify-center whitespace-nowrap"
        onClick={() => {
          openConfirmation()
        }}
      >
        <RotateCcw className="size-4" />
        Regularizar rechazo AEAT
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !busy && setOpen(nextOpen)}>
        <DialogContent className="sm:max-w-md">
          {phase === 'confirm' ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {recipientFiscalReady
                    ? 'Regularizar rechazo de AEAT'
                    : 'Validar y regularizar el rechazo'}
                </DialogTitle>
                <DialogDescription>
                  {recipientFiscalReady
                    ? 'AEAT rechazó el RegistroAlta original. No se reenviará ni modificará: se conservará como evidencia y se generará un nuevo registro de subsanación. Antes, confirma que los datos fiscales ya están corregidos.'
                    : 'Antes de crear el nuevo registro, validaremos automáticamente el NIF y la razón social con el censo AEAT. Si no coinciden, no se modificará la cadena fiscal.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={passkeyOptions ? confirmWithPasskey : prepareVerification}>
                  <RotateCcw className="size-4" />
                  {passkeyOptions
                    ? 'Confirmar con biometría'
                    : recipientFiscalReady
                      ? 'Continuar con la regularización'
                      : 'Validar y continuar'}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {phase === 'verifying' || phase === 'sending' ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {phase === 'verifying' ? 'Verificando tu identidad…' : 'Enviando regularización…'}
                </DialogTitle>
                <DialogDescription>
                  {phase === 'verifying'
                    ? 'Confirma la operación con tu passkey.'
                    : 'Estamos generando el nuevo registro y enviándolo a AEAT. No cierres esta ventana.'}
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted/30 flex items-center gap-3 rounded-md border p-4 text-sm">
                <Loader2 className="text-primary size-5 animate-spin" />
                <span>
                  {phase === 'verifying' ? 'Esperando verificación…' : 'Contactando con AEAT…'}
                </span>
              </div>
            </>
          ) : null}

          {phase === 'success' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  Regularización aceptada
                </DialogTitle>
                <DialogDescription>{message}</DialogDescription>
              </DialogHeader>
              {csv ? (
                <div className="bg-muted/30 rounded-md border p-3 text-sm">
                  <span className="text-muted-foreground">CSV AEAT</span>
                  <p className="mt-1 font-mono text-xs break-all">{csv}</p>
                </div>
              ) : null}
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="text-destructive size-5" />
                  No se pudo completar la regularización
                </DialogTitle>
                <DialogDescription className="wrap-break-word whitespace-pre-wrap">
                  {message ?? 'Se produjo un error sin detalle.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
