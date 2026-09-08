'use server'

import { lookupPostalCode } from './postal-codes'

export type PostalCodeLookupResult =
  | { found: true; city: string | null; province: string | null }
  | { found: false }

/**
 * Server Action: resolves a Spanish 5-digit ZIP to city + province.
 * Safe to call from client components.
 */
export async function lookupSpanishPostalCode(zip: string): Promise<PostalCodeLookupResult> {
  const result = lookupPostalCode(zip)
  if (!result.city && !result.province) return { found: false }
  return { found: true, city: result.city, province: result.province }
}
