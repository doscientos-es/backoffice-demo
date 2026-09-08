'use client'

import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

import type { UserVerificationScope } from './user-verification-scope'
import {
  beginPasskeyAuthentication,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
} from './webauthn-actions'

type Result = { ok: true } | { ok: false; error: string }
type StartedAuthentication =
  | { ok: true; verified: true }
  | { ok: true; verified: false; options: unknown }
  | { ok: false; error: string }

type BrowserError = {
  code?: unknown
  cause?: unknown
  message?: unknown
  name?: unknown
}

function unavailable(): { ok: false; error: string } | null {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { ok: false, error: 'Este navegador no permite biometría ni passkeys' }
  }
  return null
}

function browserError(error: unknown): Result {
  // SimpleWebAuthn wraps browser DOMExceptions in WebAuthnError and keeps the
  // original exception in `cause`. Read both layers so a credential tied to a
  // different RP ID is not mistaken for an AEAT delivery failure.
  const outer = error as BrowserError
  const cause = outer?.cause as BrowserError | undefined
  const name = typeof cause?.name === 'string' ? cause.name : outer?.name
  const code = typeof outer?.code === 'string' ? outer.code : undefined
  const message = typeof outer?.message === 'string' ? outer.message : ''

  if (name === 'AbortError') return { ok: false, error: 'La verificación se ha cancelado' }
  if (name === 'NotAllowedError') {
    return {
      ok: false,
      error: 'La verificación se ha cancelado, ha caducado o no hay una passkey disponible',
    }
  }
  if (
    name === 'SecurityError' ||
    code === 'ERROR_INVALID_RP_ID' ||
    code === 'ERROR_INVALID_DOMAIN' ||
    /RP ID|invalid domain/i.test(message)
  ) {
    return {
      ok: false,
      error:
        'Esta passkey no corresponde a este sitio. Entra en Bóveda, desbloquéala con tu contraseña maestra y pulsa «Añadir passkey».',
    }
  }
  if (name === 'NotSupportedError' || /WebAuthn is not supported/i.test(message)) {
    return { ok: false, error: 'Este navegador o dispositivo no permite usar esta passkey' }
  }
  if (name === 'InvalidStateError') {
    return {
      ok: false,
      error: 'La passkey ya no está disponible en este dispositivo. Añade una nueva desde Bóveda.',
    }
  }
  if (name === 'UnknownError') {
    return {
      ok: false,
      error:
        'El autenticador del dispositivo no ha podido procesar la passkey. Inténtalo de nuevo o añade otra desde Bóveda.',
    }
  }
  return { ok: false, error: 'No se ha podido completar la verificación biométrica' }
}

/** Prepares the challenge before a confirmation click preserves user activation. */
export async function preparePasskeyAuthentication(
  scope: UserVerificationScope,
): Promise<StartedAuthentication> {
  const started = await beginPasskeyAuthentication(scope)
  if (!started.ok || started.verified) return started

  const supportError = unavailable()
  if (supportError) return supportError
  return started
}

/** Starts the browser prompt using an already prepared challenge. */
export async function completePasskeyAuthentication(
  scope: UserVerificationScope,
  options: unknown,
): Promise<Result> {
  try {
    const response = await startAuthentication({ optionsJSON: options as never })
    return await finishPasskeyAuthentication(scope, response)
  } catch (error) {
    return browserError(error)
  }
}

/** Completes a registration flow after its feature has obtained registration options. */
export async function registerPasskey(options: unknown): Promise<Result> {
  const supportError = unavailable()
  if (supportError) return supportError

  try {
    const response = await startRegistration({ optionsJSON: options as never })
    return await finishPasskeyRegistration(response)
  } catch (error) {
    return browserError(error)
  }
}
