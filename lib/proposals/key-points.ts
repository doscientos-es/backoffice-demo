/**
 * Structured narrative blocks ("key points") used by the proposal editor,
 * the public portal and the deck. Each problem and solution is stored as an
 * ordered list of `{ id, title, description }` so the deck can render them
 * as numbered cards instead of a wall of markdown.
 *
 * This module is the single source of truth for the wire shape: the schema
 * (`lib/schemas/proposal.ts`), the server action and every UI surface go
 * through `parseKeyPoints` / `serializeKeyPoints` to keep storage and runtime
 * representations in sync.
 */

export const KEY_POINTS_LIMITS = {
  /** Hard cap on how many points a single block can hold. */
  maxCount: 20,
  maxTitleLength: 200,
  maxDescriptionLength: 2000,
} as const

export type KeyPoint = {
  id: string
  title: string
  description: string | null
}

/** UI-side variant: description is always a string so `<Textarea>` is happy. */
export type EditableKeyPoint = {
  id: string
  title: string
  description: string
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `kp-${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyKeyPoint(): EditableKeyPoint {
  return { id: newId(), title: '', description: '' }
}

/**
 * A problem paired with the solution we propose for it. This is the shape the
 * editor works with: the two stored jsonb columns (`problems`, `solutions`)
 * are zipped into pairs on load and split back on save, matching a problem to
 * its solution by a shared `id`. Keeping the wire storage as two arrays means
 * the portal and deck keep reading them independently, so no migration or
 * client-surface rewrite is needed.
 */
export type EditablePair = {
  id: string
  problem: string
  problemDescription: string
  solution: string
  solutionDescription: string
}

export function createEmptyPair(): EditablePair {
  return {
    id: newId(),
    problem: '',
    problemDescription: '',
    solution: '',
    solutionDescription: '',
  }
}

/**
 * Zip stored problems and solutions into editable pairs. A solution is matched
 * to a problem sharing its `id` (the model this editor now writes); when ids
 * don't line up — legacy proposals authored as two independent lists — it falls
 * back to positional order. Solutions with no matching problem become
 * solution-only pairs so nothing is silently dropped.
 */
export function zipKeyPoints(
  problems: ReadonlyArray<{ id: string; title: string; description?: string | null }>,
  solutions: ReadonlyArray<{ id: string; title: string; description?: string | null }>,
): EditablePair[] {
  const remaining = [...solutions]
  const takeFor = (problemId: string): (typeof remaining)[number] | undefined => {
    if (remaining.length === 0) return undefined
    const byId = remaining.findIndex((s) => s.id === problemId)
    return remaining.splice(byId >= 0 ? byId : 0, 1)[0]
  }

  const pairs: EditablePair[] = problems.map((p) => {
    const sol = takeFor(p.id)
    return {
      id: p.id,
      problem: p.title,
      problemDescription: p.description ?? '',
      solution: sol?.title ?? '',
      solutionDescription: sol?.description ?? '',
    }
  })

  for (const s of remaining) {
    pairs.push({
      id: s.id,
      problem: '',
      problemDescription: '',
      solution: s.title,
      solutionDescription: s.description ?? '',
    })
  }
  return pairs
}

/**
 * Split editable pairs back into the two `EditableKeyPoint` lists the storage
 * layer expects. Problem and solution keep the pair's `id` so a later
 * `zipKeyPoints` can re-match them. Feed each list to `serializeKeyPoints`,
 * which drops blank entries just like the standalone editor did.
 */
export function unzipPairs(pairs: EditablePair[]): {
  problems: EditableKeyPoint[]
  solutions: EditableKeyPoint[]
} {
  const problems: EditableKeyPoint[] = []
  const solutions: EditableKeyPoint[] = []
  for (const p of pairs) {
    problems.push({ id: p.id, title: p.problem, description: p.problemDescription })
    solutions.push({ id: p.id, title: p.solution, description: p.solutionDescription })
  }
  return { problems, solutions }
}

/**
 * Parse a JSON value coming from Supabase into a normalised list of key
 * points. Tolerates `null`, malformed entries and missing fields; entries
 * without a title are dropped because they would render as empty cards.
 */
export function parseKeyPoints(value: unknown): KeyPoint[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((v, i): KeyPoint => {
      const title = typeof v.title === 'string' ? v.title.trim() : ''
      const description =
        typeof v.description === 'string' && v.description.trim().length > 0 ? v.description : null
      const id = typeof v.id === 'string' && v.id.length > 0 ? v.id : `kp-${i}`
      return { id, title, description }
    })
    .filter((kp) => kp.title.length > 0)
}

/** Hydrate a stored list into the editable shape used by `<KeyPointsEditor>`. */
export function toEditableKeyPoints(items: KeyPoint[]): EditableKeyPoint[] {
  return items.map((kp) => ({
    id: kp.id,
    title: kp.title,
    description: kp.description ?? '',
  }))
}

/**
 * Serialise an editable list for the server action / database. Drops blank
 * entries (no title) and trims whitespace. Returns `null` instead of `[]` so
 * the storage column can be cleared with a single assignment, mirroring the
 * "" → null collapse the schema does for the other markdown fields.
 */
export function serializeKeyPoints(items: EditableKeyPoint[]): KeyPoint[] | null {
  const cleaned: KeyPoint[] = []
  for (const item of items) {
    const title = item.title.trim()
    if (title.length === 0) continue
    const description = item.description.trim()
    cleaned.push({
      id: item.id,
      title,
      description: description.length > 0 ? description : null,
    })
  }
  return cleaned.length > 0 ? cleaned : null
}
