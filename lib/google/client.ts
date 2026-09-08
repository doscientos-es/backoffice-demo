import { JWT } from 'google-auth-library'

/**
 * Cliente Google Workspace con service account (domain-wide delegation).
 *
 * Mintea tokens OAuth2 impersonando a un usuario @doscientos.es (`subject`) y
 * llama directamente a las REST APIs de Drive/Calendar vía fetch — mismo estilo
 * que el resto de integraciones (Meta, GitHub).
 *
 * Nunca usar sin comprobar `isGoogleEnabled()` antes.
 */
import { isGoogleEnabled, serverEnv } from '@/lib/env'

// Deben coincidir EXACTAMENTE con los scopes autorizados en la delegación de
// todo el dominio (Workspace Admin → Seguridad → Controles de API). Si el código
// pide un scope no autorizado, el intercambio JWT falla con `unauthorized_client`.
export const GOOGLE_SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive',
  calendar: 'https://www.googleapis.com/auth/calendar',
  gmail: 'https://www.googleapis.com/auth/gmail.modify',
} as const

/** Cache de clientes JWT por (subject + scopes) — evita re-parsear la clave. */
const jwtCache = new Map<string, JWT>()

/**
 * Devuelve el sujeto de impersonación correcto para la Service Account.
 *
 * - Si `userEmail` pertenece al dominio de Workspace (`@doscientos.es`) → lo
 *   usamos directamente: la acción "firma" como el miembro que la ejecutó.
 * - Si no (colaborador externo, cron, acción de sistema) → fallback al email
 *   configurado en `GOOGLE_DRIVE_SUBJECT_EMAIL` o `pol@{dominio}`.
 */
export function resolveSubject(userEmail?: string): string {
  const env = serverEnv()
  const domain = env.GOOGLE_WORKSPACE_DOMAIN
  if (userEmail && domain && userEmail.endsWith(`@${domain}`)) return userEmail
  return env.GOOGLE_DRIVE_SUBJECT_EMAIL || `pol@${domain}`
}

function decodePrivateKey(): string {
  const b64 = serverEnv().GOOGLE_SA_PRIVATE_KEY_BASE64
  const pem = Buffer.from(b64, 'base64').toString('utf8').trim()
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    throw new Error('GOOGLE_SA_PRIVATE_KEY_BASE64 no contiene una clave PEM válida.')
  }
  return pem
}

/**
 * Devuelve un cliente JWT de la service account que impersona a `subject`.
 * Lanza un error claro si la integración no está configurada.
 */
export function getGoogleClient(subject: string, scopes: string[]): JWT {
  if (!isGoogleEnabled()) {
    throw new Error(
      'Google Workspace no configurado. Añade GOOGLE_SA_CLIENT_EMAIL y GOOGLE_SA_PRIVATE_KEY_BASE64.',
    )
  }
  const key = `${subject}::${scopes.join(',')}`
  const cached = jwtCache.get(key)
  if (cached) return cached

  const client = new JWT({
    email: serverEnv().GOOGLE_SA_CLIENT_EMAIL,
    key: decodePrivateKey(),
    scopes,
    subject, // domain-wide delegation: actúa como este usuario del dominio
  })
  jwtCache.set(key, client)
  return client
}

/** Timeout por llamada a las APIs de Google. */
export const GOOGLE_TIMEOUT_MS = 20_000

type GoogleFetchInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
}

/**
 * Llama a una REST API de Google autenticada como `subject`. Devuelve el JSON
 * parseado (o `null` si la respuesta es 204). Lanza Error con el mensaje de la
 * API si el status no es 2xx.
 */
export async function googleFetch<T>(
  subject: string,
  scopes: string[],
  url: string,
  init?: GoogleFetchInit,
): Promise<T> {
  const client = getGoogleClient(subject, scopes)
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('No se pudo obtener el token de acceso de Google.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    })
    if (res.status === 204) return null as T
    const text = await res.text()
    const json = text ? JSON.parse(text) : null
    if (!res.ok) {
      const message =
        (json as { error?: { message?: string } } | null)?.error?.message ??
        `Google API ${res.status}`
      throw new Error(message)
    }
    return json as T
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('La API de Google tardó demasiado en responder (timeout 20s).')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
