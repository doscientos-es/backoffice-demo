/**
 * Helpers for reading and validating search params in a type-safe, side-effect-free way.
 * All functions are pure and work with a generic `Record<string, string | string[] | undefined>`.
 */

/** Escapes special ILIKE characters to prevent pattern injection. */
export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`)
}

type RawParams = Record<string, string | string[] | undefined>

/** Reads a param as a normalised string (trimmed). Returns `fallback` if absent. */
export function parseStringParam(params: RawParams, key: string, fallback = ''): string {
  const raw = params[key]
  if (!raw) return fallback
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? fallback
}

/**
 * Reads a param as a positive integer.
 * Returns `fallback` when the value is missing or not a valid integer ≥ 1.
 */
export function parseIntParam(params: RawParams, key: string, fallback = 1): number {
  const raw = parseStringParam(params, key)
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

/** Pagination page (always ≥ 1). */
export function parsePage(params: RawParams): number {
  return parseIntParam(params, 'page', 1)
}

/**
 * Reads a param only when its value is in `validValues`.
 * Returns `null` when the value is absent or invalid.
 */
export function parseEnumParam<T extends string>(
  params: RawParams,
  key: string,
  validValues: readonly T[],
): T | null {
  const raw = parseStringParam(params, key)
  return (validValues as readonly string[]).includes(raw) ? (raw as T) : null
}

export type SortDir = 'asc' | 'desc'

/**
 * Reads `sort` and `dir` params and validates against a list of allowed columns.
 * Falls back to `defaultColumn` and `defaultDir` when invalid.
 */
export function parseSortParam(
  params: RawParams,
  validColumns: readonly string[],
  defaultColumn: string,
  defaultDir: SortDir = 'asc',
): { sort: string; dir: SortDir } {
  const rawSort = parseStringParam(params, 'sort')
  const rawDir = parseStringParam(params, 'dir')
  const sort = (validColumns as readonly string[]).includes(rawSort) ? rawSort : defaultColumn
  const dir: SortDir = rawDir === 'asc' || rawDir === 'desc' ? rawDir : defaultDir
  return { sort, dir }
}
