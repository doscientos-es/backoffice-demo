/**
 * OpenMercantil — free public REST API for Spanish company data.
 * Source: BORME (Boletín Oficial del Registro Mercantil) + 29 official sources.
 * No API key required. Rate limit: 60 req/min · 200 req/day per IP (free tier).
 * Docs: https://openmercantil.es/api/documentacion
 */

const BASE = 'https://openmercantil.es/api/v1'
const TIMEOUT_MS = 8_000

interface SearchItem {
  name: string
  cif: string
  slug: string
  status?: string
  /** Number of registry acts — used to pick the most established match. */
  acts_count?: number
}

interface SearchResponse {
  count: number
  items: SearchItem[]
}

export interface OpenMercantilCompany {
  name: string
  cif: string
  /**
   * Company status published in the Registro Mercantil.
   * Typical values: "ACTIVA" | "EXTINGUIDA" | "DISOLUCION" | "CONCURSO"
   */
  status: string
  slug: string
}

/** Normalizes a CIF/NIF for comparison: uppercase, strip spaces and dots. */
function normalizeCif(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')
}

/**
 * Looks up a Spanish CIF in the Registro Mercantil via OpenMercantil.
 * Returns the matching company, or null if not found or on network error.
 *
 * Caches results for 24 h (Next.js fetch cache) to minimise daily quota usage.
 */
export async function findCompanyByCif(cif: string): Promise<OpenMercantilCompany | null> {
  const normalized = normalizeCif(cif)
  if (!normalized) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(normalized)}&limit=5`, {
      signal: controller.signal,
      // Cache the response for 24 h — CIF data changes rarely.
      next: { revalidate: 86_400 },
    })
    if (!res.ok) return null

    const json: SearchResponse = await res.json()
    if (!json.items?.length) return null

    // Require an exact CIF match (search can return near-matches by name/alias).
    // A recycled CIF can map to several records; pick the most established one
    // (highest number of registry acts).
    const matches = json.items.filter((item) => normalizeCif(item.cif) === normalized)
    if (!matches.length) return null
    const match = matches.reduce((best, item) =>
      (item.acts_count ?? 0) > (best.acts_count ?? 0) ? item : best,
    )

    return {
      name: match.name,
      cif: match.cif,
      status: match.status ?? 'ACTIVA',
      slug: match.slug,
    }
  } catch {
    // Network errors, timeouts and JSON parse failures → treated as "not found".
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface OpenMercantilCompanyDetails {
  name: string
  cif: string
  status: string
  /** Province of the registered address (domicilio social). */
  province?: string
  /** Municipality of the registered address. */
  city?: string
  /** Full address string as published in the BORME. */
  address?: string
  /** Legal form abbreviation: SA, SL, SLU, SLL, etc. */
  companyType?: string
  /**
   * Current officers, cleaned and ranked for "persona de contacto" suggestions.
   * Derived from the detail response's pre-computed `officers.current` list.
   */
  officers: OpenMercantilOfficer[]
}

/**
 * Company detail response shape (verified against the live API).
 * Company identity lives under `company.*`; the registered province is
 * derived from `top_provinces` (the API does not expose a municipality).
 * `officers.current` is OpenMercantil's own pre-computed active-officers list.
 */
interface CompanyDetailResponse {
  company?: {
    name?: string
    cif?: string
    status?: string
    company_type?: string
    address?: string
    website?: string
  }
  top_provinces?: { province?: string; count?: number }[]
  officers?: {
    current?: RawOfficer[]
    historical?: RawOfficer[]
  }
}

/**
 * Fetches full company details by slug from OpenMercantil: legal form, province
 * and the cleaned list of current officers. Called once after `findCompanyByCif`
 * — the detail payload already embeds `officers`, so no separate request is
 * needed (halving quota usage). Cached for 24 h (Next.js fetch cache).
 */
export async function getCompanyDetails(slug: string): Promise<OpenMercantilCompanyDetails | null> {
  if (!slug) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE}/company/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      next: { revalidate: 86_400 },
    })
    if (!res.ok) return null

    const json: CompanyDetailResponse = await res.json()
    const c = json.company
    if (!c?.name) return null

    // Most-active province, ignoring the "National" bucket (state-level acts).
    const province = json.top_provinces?.find(
      (p) => p.province && p.province !== 'National',
    )?.province

    return {
      name: c.name,
      cif: c.cif ?? '',
      status: c.status ?? 'ACTIVA',
      province,
      city: undefined,
      address: c.address,
      companyType: c.company_type,
      officers: buildOfficerSuggestions(json.officers?.current ?? []),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Returns true if the local (country-prefix-stripped) identifier is a CIF
 * (empresa/entidad): first character is a letter that is not X, Y, or Z
 * (those indicate a NIE / foreign-resident individual).
 */
export function isCifNumber(localNum: string): boolean {
  return /^[A-WÑ]/i.test(localNum.trim())
}

export interface OpenMercantilOfficer {
  name: string
  role: string
  since?: string
}

interface RawOfficer {
  name?: string
  role?: string
  since?: string
  person_slug?: string
}

// Roles that identify an audit firm, never a "persona de contacto".
const EXCLUDED_ROLE = /auditor/i

// Corporate-entity markers — a contact person must be an individual, not a firm.
const CORPORATE_MARKER = /(\bS\.?L\.?\b|\bS\.?A\.?\b|SOCIEDAD|AUDITORES|\bSLU\b|\bSLL\b|\bAIE\b)/i

// Contact suggestions prioritise decision-makers. Lower weight = higher priority.
// Matched case-insensitively against the role reported by the BORME, so it
// tolerates variants like "Administrador Único" / "Apoderado Mancomunado".
const ROLE_PRIORITY: { pattern: RegExp; weight: number }[] = [
  { pattern: /administrador\s+único/i, weight: 0 },
  { pattern: /administrador\s+solidario/i, weight: 1 },
  { pattern: /administrador\s+mancomunado/i, weight: 2 },
  { pattern: /administrador/i, weight: 3 },
  { pattern: /consejero\s+delegado/i, weight: 4 },
  { pattern: /presidente/i, weight: 5 },
  { pattern: /consejero/i, weight: 6 },
  { pattern: /apoderado/i, weight: 7 },
  { pattern: /secretario/i, weight: 8 },
]

function roleWeight(role: string): number {
  return ROLE_PRIORITY.find((r) => r.pattern.test(role))?.weight ?? 99
}

/**
 * BORME officer names often carry a role prefix or a duplicated trailing name
 * (e.g. "auditor_concursal: NAME" or "NAME. Apo.Sol.: NAME"). Keep only the
 * human-readable name after the last colon.
 */
function cleanOfficerName(raw: string): string {
  const name = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw
  return name.trim()
}

/**
 * Cleans, de-duplicates and ranks OpenMercantil's pre-computed `officers.current`
 * list for use as "persona de contacto" suggestions. Audit firms and corporate
 * entities are excluded (a contact must be an individual). Returns at most 6
 * suggestions, decision-makers first. When `current` is empty we return an empty
 * list rather than guessing from the raw BORME events (which could surface a
 * revoked officer as an active contact).
 */
function buildOfficerSuggestions(raw: RawOfficer[]): OpenMercantilOfficer[] {
  const seen = new Set<string>()
  return raw
    .filter((o) => o.name && !EXCLUDED_ROLE.test(o.role ?? ''))
    .map((o) => ({
      name: cleanOfficerName(o.name as string),
      role: o.role ?? '',
      since: o.since,
    }))
    .filter((o) => {
      if (o.name.length < 3 || CORPORATE_MARKER.test(o.name)) return false
      const key = o.name.toUpperCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => roleWeight(a.role) - roleWeight(b.role))
    .slice(0, 6)
}
