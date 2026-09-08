'use server'

import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

import { grantUserVerification, hasRecentUserVerification } from './user-verification'
import { USER_VERIFICATION_INTENTS, type UserVerificationScope } from './user-verification-scope'
import {
  createPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from './webauthn'

const transport = z.enum(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'])
const credentialBase = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal('public-key'),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.unknown()),
})
const registrationResponse = credentialBase.extend({
  response: z.object({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    authenticatorData: z.string().min(1).optional(),
    transports: z.array(transport).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: z.string().min(1).optional(),
  }),
})
const authenticationResponse = credentialBase.extend({
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().min(1).optional(),
  }),
})
const verificationScopeSchema = z.object({
  intent: z.enum(USER_VERIFICATION_INTENTS),
  resource: z.string().min(1).max(512),
})

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function failure<T = object>(error: unknown): Result<T> {
  return { ok: false, error: error instanceof Error ? error.message : 'Error de verificación' }
}

/** Finalizes an enrollment challenge created by a feature-specific server action. */
export async function finishPasskeyRegistration(rawResponse: unknown): Promise<Result> {
  const parsed = registrationResponse.safeParse(rawResponse)
  if (!parsed.success) return { ok: false, error: 'Respuesta biométrica no válida' }

  try {
    const user = await requireUser()
    await verifyPasskeyRegistration(user.id, parsed.data as RegistrationResponseJSON)
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

/** Reuses a recent verification or starts an intent-scoped WebAuthn challenge. */
export async function beginPasskeyAuthentication(
  rawScope: unknown,
): Promise<Result<{ verified: true } | { verified: false; options: unknown }>> {
  const parsed = verificationScopeSchema.safeParse(rawScope)
  if (!parsed.success) return { ok: false, error: 'Acción protegida no válida' }

  try {
    const user = await requireUser()
    if (await hasRecentUserVerification(user.id)) return { ok: true, verified: true }
    const options = await createPasskeyAuthenticationOptions(user.id, parsed.data)
    return { ok: true, verified: false, options }
  } catch (error) {
    return failure(error)
  }
}

/** Completes WebAuthn and starts a recent-verification session. */
export async function finishPasskeyAuthentication(
  rawScope: unknown,
  rawResponse: unknown,
): Promise<Result> {
  const scope = verificationScopeSchema.safeParse(rawScope)
  const response = authenticationResponse.safeParse(rawResponse)
  if (!scope.success || !response.success)
    return { ok: false, error: 'Respuesta biométrica no válida' }

  try {
    const user = await requireUser()
    await verifyPasskeyAuthentication(
      user.id,
      scope.data as UserVerificationScope,
      response.data as AuthenticationResponseJSON,
    )
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

/** Starts the same recent-verification session after Supabase MFA. */
export async function grantUserVerificationFromMfa(rawScope: unknown): Promise<Result> {
  const parsed = verificationScopeSchema.safeParse(rawScope)
  if (!parsed.success) return { ok: false, error: 'Acción protegida no válida' }

  try {
    const user = await requireUser()
    const supabase = await createServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
      session?.access_token,
    )
    if (error || data?.currentLevel !== 'aal2') {
      throw new Error('La verificación MFA no se ha podido confirmar')
    }
    await grantUserVerification(user.id, parsed.data as UserVerificationScope)
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}
