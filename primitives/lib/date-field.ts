import { format, isValid, parse } from 'date-fns'

export const DISPLAY_FMT = 'dd/MM/yyyy'
export const ISO_FMT = 'yyyy-MM-dd'

/**
 * ISO `yyyy-MM-dd` → display `dd/MM/yyyy`.
 * Returns `""` for empty / invalid input.
 */
export function isoToDisplay(iso: string): string {
  if (!iso) return ''
  const d = parse(iso, ISO_FMT, new Date())
  if (!isValid(d)) return ''
  return format(d, DISPLAY_FMT)
}

/**
 * Display `dd/MM/yyyy` → ISO `yyyy-MM-dd`.
 * Returns `""` when the input is incomplete or the date doesn't exist.
 */
export function displayToIso(text: string): string {
  if (text.length < 10) return ''
  const d = parse(text, DISPLAY_FMT, new Date())
  if (!isValid(d)) return ''
  if (format(d, DISPLAY_FMT) !== text) return ''
  return format(d, ISO_FMT)
}

/**
 * Masks raw keyboard input into `dd/MM/yyyy` progressively inserting `/`.
 * Strips non-digit characters, limits to 8 significant digits.
 */
export function maskDate(value: string): string {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}

/**
 * Maps a cursor position inside the raw (pre-mask) string to the
 * equivalent position inside the masked string.
 */
export function mapCursorToMasked(rawCursor: number, rawValue: string, masked: string): number {
  const digitsBeforeCursor = rawValue.slice(0, rawCursor).replace(/[^0-9]/g, '').length
  let digitsSeen = 0
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '/') digitsSeen++
    if (digitsSeen === digitsBeforeCursor) return i + 1
  }
  return masked.length
}
