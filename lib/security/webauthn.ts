import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { cookies, headers } from 'next/headers'

import { DEMO_SIGNING_KEY } from '@/lib/demo/config'
import { createAdminClient } from '@/lib/supabase/admin'

import { grantUserVerification } from './user-verification'
import type { UserVerificationScope } from './user-verification-scope'

const CHALLENGE_COOKIE = 'webauthn_challenge'
const CHALLENGE_MAX_AGE_SECONDS = 5 * 60
const TRANSPORTS = ['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'] as const
const PRODUCTION_ORIGIN = 'https://app.doscientos.es'
const PRODUCTION_RP_ID = 'app.doscientos.es'

type ChallengeKind = 'registration' | 'authentication'
type Challenge = {
  challenge: string
  userId: string
  kind: ChallengeKind
  scope?: UserVerificationScope
  expectedOrigin: string
  rpID: string
  expiresAt: number
}
type WebAuthnUser = { id: string; email: string; name: string }
type CredentialRow = {
  credential_id: string
  public_key: string
  counter: number
  rp_id: string | null
  transports: string[] | null
}

type RequestOrigin = { origin: string | null; host: string | null; protocol: string | null }
type WebAuthnConfig = { expectedOrigin: string; rpID: string; rpName: string }

function requestOrigin({ origin, host, protocol }: RequestOrigin): string | null {
  if (origin) return origin
  if (!host) return null
  return `${protocol?.split(',')[0]?.trim() || (host.startsWith('localhost') ? 'http' : 'https')}://${host}`
}

/** Resolves only origins that are deliberately allowed to perform WebAuthn ceremonies. */
export function resolveWebAuthnConfig(request: RequestOrigin): WebAuthnConfig {
  const origin = requestOrigin(request)
  if (origin === PRODUCTION_ORIGIN) {
    return { expectedOrigin: PRODUCTION_ORIGIN, rpID: PRODUCTION_RP_ID, rpName: 'Doscientos' }
  }

  try {
    const url = new URL(origin ?? '')
    if (url.protocol === 'http:' && url.hostname === 'localhost') {
      return { expectedOrigin: url.origin, rpID: 'localhost', rpName: 'Doscientos (local)' }
    }

  } catch {
    // Fall through to the generic, non-sensitive configuration error below.
  }

  throw new Error('La biometría solo está disponible en el dominio seguro configurado')
}

async function config(): Promise<WebAuthnConfig> {
  const requestHeaders = await headers()
  return resolveWebAuthnConfig({
    origin: requestHeaders.get('origin'),
    host: requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
    protocol: requestHeaders.get('x-forwarded-proto'),
  })
}

function sign(value: string): string {
  return createHmac('sha256', DEMO_SIGNING_KEY)
    .update(`webauthn-challenge:${value}`)
    .digest('base64url')
}

function encode(challenge: Challenge): string {
  const value = Buffer.from(JSON.stringify(challenge)).toString('base64url')
  return `${value}.${sign(value)}`
}

function decode(cookieValue: string | undefined): Challenge | null {
  if (!cookieValue) return null
  const [value, signature] = cookieValue.split('.')
  if (!value || !signature) return null

  const expected = Buffer.from(sign(value))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

  try {
    const challenge = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Challenge
    if (
      !challenge.userId ||
      !challenge.challenge ||
      !['registration', 'authentication'].includes(challenge.kind) ||
      !Number.isSafeInteger(challenge.expiresAt) ||
      challenge.expiresAt <= Date.now()
    ) {
      return null
    }
    return challenge
  } catch {
    return null
  }
}

async function storeChallenge(challenge: Challenge): Promise<void> {
  const store = await cookies()
  store.set(CHALLENGE_COOKIE, encode(challenge), {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
    maxAge: CHALLENGE_MAX_AGE_SECONDS,
  })
}

async function consumeChallenge(userId: string, kind: ChallengeKind): Promise<Challenge> {
  const store = await cookies()
  const challenge = decode(store.get(CHALLENGE_COOKIE)?.value)
  store.delete(CHALLENGE_COOKIE)

  if (!challenge || challenge.userId !== userId || challenge.kind !== kind) {
    throw new Error('La verificación ha caducado. Inténtalo de nuevo.')
  }
  return challenge
}

function validTransports(transports: string[] | null): AuthenticatorTransportFuture[] | undefined {
  if (!transports) return undefined
  const result = transports.filter((value): value is AuthenticatorTransportFuture =>
    TRANSPORTS.includes(value as (typeof TRANSPORTS)[number]),
  )
  return result.length > 0 ? result : undefined
}

async function credentialsFor(userId: string, rpID: string): Promise<CredentialRow[]> {
  // Credentials are security factors: direct browser writes are blocked by RLS.
  // This server-only lookup is safe because every caller supplies the current user.
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('credential_id, public_key, counter, rp_id, transports')
    .eq('user_id', userId)
  if (error) throw new Error('No se han podido consultar las credenciales biométricas')
  return ((data as CredentialRow[] | null) ?? []).filter(
    (credential) => credential.rp_id === rpID || (!credential.rp_id && rpID === PRODUCTION_RP_ID),
  )
}

/** Returns whether the current user has at least one registered passkey. */
export async function hasRegisteredPasskey(userId: string): Promise<boolean> {
  const { rpID } = await config()
  return (await credentialsFor(userId, rpID)).length > 0
}

/** Creates an attestation challenge after the caller has applied its enrollment policy. */
export async function createPasskeyRegistrationOptions(user: WebAuthnUser) {
  const webauthn = await config()
  const existing = await credentialsFor(user.id, webauthn.rpID)
  const options = await generateRegistrationOptions({
    rpName: webauthn.rpName,
    rpID: webauthn.rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    timeout: CHALLENGE_MAX_AGE_SECONDS * 1000,
    excludeCredentials: existing.map((credential) => ({
      id: credential.credential_id,
      transports: validTransports(credential.transports),
    })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  })
  await storeChallenge({
    challenge: options.challenge,
    userId: user.id,
    kind: 'registration',
    expectedOrigin: webauthn.expectedOrigin,
    rpID: webauthn.rpID,
    expiresAt: Date.now() + CHALLENGE_MAX_AGE_SECONDS * 1000,
  })
  return options
}

/** Validates and persists the public part of a newly registered passkey. */
export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
): Promise<void> {
  const challenge = await consumeChallenge(userId, 'registration')
  const webauthn = await config()
  if (challenge.expectedOrigin !== webauthn.expectedOrigin || challenge.rpID !== webauthn.rpID) {
    throw new Error('La verificación no corresponde a este sitio')
  }
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: webauthn.expectedOrigin,
    expectedRPID: webauthn.rpID,
    requireUserVerification: true,
  })
  if (!verification.verified || !verification.registrationInfo?.userVerified) {
    throw new Error('No se ha podido verificar la biometría o el bloqueo del dispositivo')
  }

  const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo
  // RLS blocks client writes. Only this server-side code reaches service_role,
  // after validating the signed registration response and consuming its challenge.
  const supabase = createAdminClient()
  const { error } = await supabase.from('webauthn_credentials').insert({
    user_id: userId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: response.response.transports ?? [],
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    rp_id: webauthn.rpID,
  })
  if (error) throw new Error('No se ha podido guardar la credencial biométrica')
}

/** Creates an assertion challenge restricted to the current user's passkeys. */
export async function createPasskeyAuthenticationOptions(
  userId: string,
  scope: UserVerificationScope,
) {
  const webauthn = await config()
  const existing = await credentialsFor(userId, webauthn.rpID)
  if (existing.length === 0) throw new Error('No tienes biometría configurada en esta cuenta')

  const options = await generateAuthenticationOptions({
    rpID: webauthn.rpID,
    timeout: CHALLENGE_MAX_AGE_SECONDS * 1000,
    userVerification: 'required',
    allowCredentials: existing.map((credential) => ({
      id: credential.credential_id,
      transports: validTransports(credential.transports),
    })),
  })
  await storeChallenge({
    challenge: options.challenge,
    userId,
    kind: 'authentication',
    scope,
    expectedOrigin: webauthn.expectedOrigin,
    rpID: webauthn.rpID,
    expiresAt: Date.now() + CHALLENGE_MAX_AGE_SECONDS * 1000,
  })
  return options
}

/** Verifies an assertion, advances its signature counter, and starts a recent session. */
export async function verifyPasskeyAuthentication(
  userId: string,
  scope: UserVerificationScope,
  response: AuthenticationResponseJSON,
): Promise<void> {
  const challenge = await consumeChallenge(userId, 'authentication')
  if (challenge.scope?.intent !== scope.intent || challenge.scope.resource !== scope.resource) {
    throw new Error('La verificación no corresponde a esta acción')
  }

  const webauthn = await config()
  if (challenge.expectedOrigin !== webauthn.expectedOrigin || challenge.rpID !== webauthn.rpID) {
    throw new Error('La verificación no corresponde a este sitio')
  }
  const credential = (await credentialsFor(userId, webauthn.rpID)).find(
    (candidate) => candidate.credential_id === response.id,
  )
  if (!credential) throw new Error('La credencial biométrica no está autorizada')

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: webauthn.expectedOrigin,
    expectedRPID: webauthn.rpID,
    requireUserVerification: true,
    credential: {
      id: credential.credential_id,
      publicKey: new Uint8Array(Buffer.from(credential.public_key, 'base64url')),
      counter: credential.counter,
      transports: validTransports(credential.transports),
    },
  })
  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    throw new Error('No se ha podido verificar la biometría o el bloqueo del dispositivo')
  }

  // The signature counter can advance only after a successful assertion.
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('webauthn_credentials')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
      rp_id: webauthn.rpID,
    })
    .eq('user_id', userId)
    .eq('credential_id', credential.credential_id)
  if (error) throw new Error('No se ha podido actualizar la credencial biométrica')

  await grantUserVerification(userId, scope)
}
