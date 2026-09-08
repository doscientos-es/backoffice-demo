/**
 * Offline Spanish NIF / NIE / CIF checksum validation.
 *
 * Validates locally before any network call, avoiding wasted VIES requests
 * for obviously invalid identifiers.
 *
 * References:
 *   NIF/NIE – BOE-A-2008-18696
 *   CIF      – Real Decreto 1065/2007, art. 18
 */

const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const CIF_CONTROL_LETTERS = 'JABCDEFGHI'
/** First-letter alphabet for CIF (AEAT valid letters). */
const CIF_FIRST_LETTERS = new Set('ABCDEFGHJKLMNPQRSUVW')
/** Letters that REQUIRE a letter control digit. */
const CIF_LETTER_CONTROL = new Set('KPQRSW')
/** Letters that REQUIRE a numeric control digit. */
const CIF_DIGIT_CONTROL = new Set('ABEH')

function validateNif(v: string): boolean {
  if (!/^\d{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(v)) return false
  const num = Number.parseInt(v.slice(0, 8), 10)
  return v[8] === NIF_LETTERS[num % 23]
}

function validateNie(v: string): boolean {
  if (!/^[XYZ]\d{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(v)) return false
  const firstDigit = v[0] === 'X' ? '0' : v[0] === 'Y' ? '1' : '2'
  const num = Number.parseInt(firstDigit + v.slice(1, 8), 10)
  return v[8] === NIF_LETTERS[num % 23]
}

function validateCif(v: string): boolean {
  if (v.length !== 9) return false
  const firstLetter = v[0]! // length === 9 guarantees this exists
  if (!CIF_FIRST_LETTERS.has(firstLetter)) return false
  if (!/^\d{7}$/.test(v.slice(1, 8))) return false

  const digits = v.slice(1, 8)
  let oddSum = 0
  let evenSum = 0
  for (let i = 0; i < 7; i++) {
    // digits[i] is guaranteed to exist by the /^\d{7}$/ regex check above
    const d = Number.parseInt(digits[i]!, 10)
    if (i % 2 === 0) {
      // odd positions (1,3,5,7) — 0-indexed: 0,2,4,6
      const doubled = d * 2
      oddSum += doubled > 9 ? doubled - 9 : doubled
    } else {
      // even positions (2,4,6) — 0-indexed: 1,3,5
      evenSum += d
    }
  }
  const controlDigit = (10 - ((oddSum + evenSum) % 10)) % 10
  const controlLetter = CIF_CONTROL_LETTERS[controlDigit]!
  // v[8] is guaranteed by the length === 9 check above
  const last = v[8]!

  if (CIF_LETTER_CONTROL.has(firstLetter)) return last === controlLetter
  if (CIF_DIGIT_CONTROL.has(firstLetter)) return last === String(controlDigit)
  return last === String(controlDigit) || last === controlLetter
}

export type NifValidationResult =
  | { valid: true; type: 'nif' | 'nie' | 'cif' }
  | { valid: false; message: string }

/**
 * Validates a Spanish NIF (DNI), NIE, or CIF offline via checksum.
 * Pass the raw value — spaces, dots, and hyphens are ignored.
 */
export function validateNifEs(raw: string): NifValidationResult {
  const v = raw
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/g, '')
  if (!v) return { valid: false, message: 'El NIF/CIF está vacío.' }

  if (validateNif(v)) return { valid: true, type: 'nif' }
  if (validateNie(v)) return { valid: true, type: 'nie' }
  if (validateCif(v)) return { valid: true, type: 'cif' }

  // Provide specific feedback when the format matches but checksum fails
  if (/^\d{8}[A-Z]$/.test(v))
    return { valid: false, message: 'Dígito de control del DNI incorrecto.' }
  if (/^[XYZ]\d{7}[A-Z]$/.test(v))
    return { valid: false, message: 'Dígito de control del NIE incorrecto.' }
  if (/^[A-Z]\d{7}[0-9A-Z]$/.test(v))
    return { valid: false, message: 'Dígito de control del CIF incorrecto.' }

  return {
    valid: false,
    message:
      'Formato no reconocido. Debe ser NIF (8 dígitos + letra), NIE (X/Y/Z + 7 dígitos + letra) o CIF (letra + 7 dígitos + control).',
  }
}
