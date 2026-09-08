/**
 * Fractional indexing for Kanban-style ordering.
 * Given two adjacent keys (a, b), returns a key strictly between them
 * (or after a / before b when one side is null). Keys are strings of
 * lowercase ASCII letters [a-z]; JS string comparison is lexicographic
 * over code units, so we never need numeric parsing on the DB side.
 *
 * Reference: rauschma/fractional-indexing (simplified to a-z only).
 */

const FIRST = 'a'
const LAST = 'z'
const FIRST_CODE = FIRST.charCodeAt(0) // 97
const LAST_CODE = LAST.charCodeAt(0) // 122

function isValid(key: string): boolean {
  if (key.length === 0) return true
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    if (c < FIRST_CODE || c > LAST_CODE) return false
  }
  return true
}

/**
 * Return a key strictly greater than `a` and strictly less than `b`.
 * Pass empty string / null on either side to mean "open-ended".
 */
export function rankBetween(a: string | null, b: string | null): string {
  const left = a ?? ''
  const right = b ?? ''
  if (!isValid(left) || !isValid(right)) {
    throw new Error(`Invalid rank key: ${JSON.stringify({ a, b })}`)
  }
  if (right && left >= right) {
    throw new Error(`rankBetween requires a < b (got ${left} >= ${right})`)
  }
  return midpoint(left, right)
}

function midpoint(a: string, b: string): string {
  const maxI = b.length === 0 ? a.length : Math.min(a.length, b.length)
  let i = 0
  while (i < maxI && a[i] === b[i]) i++
  const prefix = a.slice(0, i)

  const aC = i < a.length ? a.charCodeAt(i) : FIRST_CODE - 1
  const bC = b.length > 0 && i < b.length ? b.charCodeAt(i) : LAST_CODE + 1

  if (bC - aC > 1) {
    return prefix + String.fromCharCode((aC + bC) >> 1)
  }

  const head = i < a.length ? a[i] : FIRST
  return prefix + head + midpoint(a.slice(i + 1), '')
}

/** Generate a rank that sorts after `last` (or first one ever). */
export function rankAfter(last: string | null): string {
  return rankBetween(last, null)
}

/** Generate a rank that sorts before `first` (or first one ever). */
export function rankBefore(first: string | null): string {
  return rankBetween(null, first)
}
