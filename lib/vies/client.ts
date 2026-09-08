/**
 * VIES (VAT Information Exchange System) — EU official public API.
 * No API key required. Validates EU VAT numbers in real time.
 *
 * Docs: https://ec.europa.eu/taxation_customs/vies/#/technical-information
 * REST: GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{cc}/vat/{vatNumber}
 */

const VIES_BASE = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms'
const VIES_TIMEOUT_MS = 10_000

/** Two-letter EU country codes that VIES accepts. */
const EU_COUNTRY_CODES = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'EL',
  'ES',
  'FI',
  'FR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'XI',
])

import type { OpenMercantilOfficer } from '../openmercantil/client'

export type ViesResult =
  | {
      valid: true
      countryCode: string
      vatNumber: string
      name?: string
      address?: string
      /** Where the positive match was found. */
      source?: 'vies' | 'openmercantil' | 'es-checksum'
      /**
       * Company lifecycle status from the Registro Mercantil.
       * Only set when source is "openmercantil".
       * Typical values: "ACTIVA" | "EXTINGUIDA" | "DISOLUCION" | "CONCURSO"
       */
      companyStatus?: string
      /** Province of the registered address (domicilio social). Only set when source is "openmercantil". */
      province?: string
      /** Municipality of the registered address. Only set when source is "openmercantil". */
      city?: string
      /** Legal form abbreviation (SA, SL, SLU…). Only set when source is "openmercantil". */
      companyType?: string
      /** Current company officers (administrators, etc.) from Registro Mercantil. Only set when source is "openmercantil". */
      officers?: OpenMercantilOfficer[]
    }
  | {
      valid: false
      /**
       * - "invalid"   → bad format / failed offline checksum
       * - "not_found" → format OK but not registered in VIES (normal for domestic-only companies)
       * - "not_eu"    → country code outside EU
       * - "api_error" → VIES returned an HTTP error
       * - "timeout"   → VIES did not respond in time
       */
      reason: 'invalid' | 'not_found' | 'not_eu' | 'api_error' | 'timeout'
      message: string
    }

/**
 * Parses a raw NIF/CIF/VAT string into its country code and local number.
 *
 * Accepts:
 * - "ESB12345678"  → { cc: "ES", num: "B12345678" }
 * - "B12345678"    → { cc: "ES", num: "B12345678" }  (assumes Spain)
 * - "DE123456789"  → { cc: "DE", num: "123456789" }
 */
function parseVat(raw: string): { cc: string; num: string } | null {
  const v = raw
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')
  if (v.length < 2) return null

  const maybeCC = v.slice(0, 2)
  if (EU_COUNTRY_CODES.has(maybeCC)) {
    return { cc: maybeCC, num: v.slice(2) }
  }
  // No country prefix → assume Spain
  return { cc: 'ES', num: v }
}

interface ViesApiResponse {
  valid: boolean
  countryCode?: string
  vatNumber?: string
  name?: string
  address?: string
  errorWrappers?: Array<{ error: string }>
}

/**
 * Validates a VAT number via VIES.
 * For Spanish NIFs/CIFs, runs an offline checksum first to avoid wasted requests.
 *
 * @param nif  Raw NIF/CIF/VAT string (e.g. "ESB12345678", "B12345678", "DE123456789")
 */
export async function validateVatVies(nif: string): Promise<ViesResult> {
  const parsed = parseVat(nif)
  if (!parsed) {
    return { valid: false, reason: 'invalid', message: 'Formato de NIF/VAT no reconocido.' }
  }

  // Short-circuit: offline checksum for Spanish identifiers
  if (parsed.cc === 'ES') {
    const { validateNifEs } = await import('./nif')
    const local = validateNifEs(parsed.num)
    if (!local.valid) {
      return { valid: false, reason: 'invalid', message: local.message }
    }
  }

  if (!EU_COUNTRY_CODES.has(parsed.cc)) {
    return {
      valid: false,
      reason: 'not_eu',
      message: `El país "${parsed.cc}" no está en la UE. VIES solo valida IVA intracomunitario.`,
    }
  }
  if (!parsed.num) {
    return { valid: false, reason: 'invalid', message: 'El número de VAT está vacío.' }
  }

  const url = `${VIES_BASE}/${parsed.cc}/vat/${parsed.num}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VIES_TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal })
    const json: ViesApiResponse = await res.json()

    if (!res.ok) {
      const errMsg = json.errorWrappers?.[0]?.error ?? `VIES HTTP ${res.status}`
      return { valid: false, reason: 'api_error', message: errMsg }
    }

    if (!json.valid) {
      return {
        valid: false,
        reason: 'not_found',
        message:
          'No encontrado en VIES como operador intracomunitario. El formato es correcto, pero este número no está dado de alta para IVA europeo (normal si solo opera en España).',
      }
    }

    return {
      valid: true,
      countryCode: json.countryCode ?? parsed.cc,
      vatNumber: json.vatNumber ?? parsed.num,
      name: json.name?.trim() || undefined,
      address: json.address?.trim() || undefined,
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { valid: false, reason: 'timeout', message: 'VIES no respondió a tiempo (10s).' }
    }
    return {
      valid: false,
      reason: 'api_error',
      message: err instanceof Error ? err.message : 'Error desconocido al contactar VIES.',
    }
  } finally {
    clearTimeout(timer)
  }
}
