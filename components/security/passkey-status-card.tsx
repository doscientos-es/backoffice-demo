'use client'

import { Fingerprint, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { PasskeyEnrollmentForm } from './passkey-enrollment-form'

/** Shows the account-specific passkey status without exposing credential metadata. */
export function PasskeyStatusCard({
  configured,
  vaultPasswordSet,
  setupHref,
}: {
  configured: boolean
  vaultPasswordSet?: boolean
  /** Use when this card is shown outside Security, where enrollment is managed. */
  setupHref?: string
}) {
  const [enrolling, setEnrolling] = useState(false)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-md p-2">
                {configured ? (
                  <ShieldCheck className="size-5" />
                ) : (
                  <Fingerprint className="size-5" />
                )}
              </div>
              <div>
                <CardTitle>Biometría y passkeys</CardTitle>
                <CardDescription>
                  {configured
                    ? 'Tu cuenta puede confirmar acciones sensibles con el bloqueo del dispositivo.'
                    : 'Protege las acciones sensibles con Face ID, Windows Hello, Touch ID o el PIN del dispositivo.'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={configured ? 'success' : 'neutral'} className="shrink-0">
              {configured ? 'Configurada' : 'Pendiente'}
            </Badge>
          </div>
        </CardHeader>
        {!configured ? (
          <CardContent className="pt-0">
            {setupHref ? (
              <Button asChild size="sm">
                <Link href={setupHref}>
                  <Fingerprint className="size-3.5" /> Configurar biometría
                </Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setEnrolling(true)}>
                <Fingerprint className="size-3.5" /> Configurar biometría
              </Button>
            )}
          </CardContent>
        ) : null}
      </Card>
      {!setupHref ? (
        <Dialog open={enrolling} onOpenChange={setEnrolling}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Configurar biometría</DialogTitle>
              <DialogDescription>
                {vaultPasswordSet
                  ? 'Confirma tu contraseña maestra antes de registrar la passkey de este dispositivo.'
                  : 'Antes de activar la biometría, configura una contraseña maestra para la bóveda.'}
              </DialogDescription>
            </DialogHeader>
            {vaultPasswordSet ? (
              <PasskeyEnrollmentForm onClose={() => setEnrolling(false)} />
            ) : (
              <Button asChild>
                <Link href="/vault">Configurar contraseña maestra</Link>
              </Button>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
