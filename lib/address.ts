/**
 * Shared address helpers.
 *
 * The structured address type is the canonical representation across
 * clients, invoices (snapshot), and company settings.
 */

export type StructuredAddress = {
  street?: string | null
  zip?: string | null
  city?: string | null
  province?: string | null
  /** ISO 3166-1 alpha-2 country code. Defaults to 'ES'. */
  country?: string | null
}

/**
 * Renders a structured address as a multi-line string suitable for
 * display in the PDF and HTML portal.
 *
 * Format:
 *   Calle Mayor 1
 *   08001 Barcelona
 *   Cataluña           ← omitted when empty
 *   DE                 ← omitted when 'ES' (domestic)
 */
export function formatAddress(addr: StructuredAddress): string {
  const line1 = addr.street?.trim() || null
  const zipCity = [addr.zip?.trim(), addr.city?.trim()].filter(Boolean).join(' ') || null
  const province = addr.province?.trim() || null
  const country =
    addr.country && addr.country.trim().toUpperCase() !== 'ES'
      ? addr.country.trim().toUpperCase()
      : null
  return [line1, zipCity, province, country].filter(Boolean).join('\n')
}

/** Returns true only if at least one address part is filled. */
export function hasAddress(addr: StructuredAddress): boolean {
  return !!(addr.street || addr.zip || addr.city || addr.province)
}

/**
 * ISO 3166-1 alpha-2 country codes with their Spanish names.
 * Focused on the most common countries for a Spanish-market app.
 */
export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'ES', label: 'España' },
  { code: 'AD', label: 'Andorra' },
  { code: 'PT', label: 'Portugal' },
  { code: 'FR', label: 'Francia' },
  { code: 'DE', label: 'Alemania' },
  { code: 'IT', label: 'Italia' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'NL', label: 'Países Bajos' },
  { code: 'BE', label: 'Bélgica' },
  { code: 'CH', label: 'Suiza' },
  { code: 'AT', label: 'Austria' },
  { code: 'SE', label: 'Suecia' },
  { code: 'DK', label: 'Dinamarca' },
  { code: 'NO', label: 'Noruega' },
  { code: 'FI', label: 'Finlandia' },
  { code: 'PL', label: 'Polonia' },
  { code: 'CZ', label: 'República Checa' },
  { code: 'RO', label: 'Rumanía' },
  { code: 'HU', label: 'Hungría' },
  { code: 'GR', label: 'Grecia' },
  { code: 'IE', label: 'Irlanda' },
  { code: 'LU', label: 'Luxemburgo' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
  { code: 'CL', label: 'Chile' },
  { code: 'BR', label: 'Brasil' },
]
