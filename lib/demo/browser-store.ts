/** A synchronous storage boundary, normally backed by the browser's localStorage. */
export type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type DemoRecord = Record<string, unknown>
export type DemoDatabase = Record<string, DemoRecord[]>

const STORAGE_KEY = 'doscientos:backoffice-demo:v1'

function isDatabase(value: unknown): value is DemoDatabase {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (rows) =>
        Array.isArray(rows) &&
        rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row)),
    )
  )
}

/**
 * Browser-only demo persistence. Each instance reads storage on every operation,
 * so other tabs and newly created instances see the latest saved snapshot.
 */
export function createBrowserDemoStore(storage: DemoStorage, seed: DemoDatabase) {
  const initial = structuredClone(seed)

  function read(): DemoDatabase {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return structuredClone(initial)

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('Los datos locales de la demo están dañados; restablécelos para continuar.')
    }
    if (!isDatabase(parsed)) {
      throw new Error('Los datos locales de la demo están dañados; restablécelos para continuar.')
    }
    return parsed
  }

  return {
    read,
    update(change: (draft: DemoDatabase) => void): DemoDatabase {
      const draft = read()
      change(draft)
      if (!isDatabase(draft)) throw new Error('Los datos de la demo no son válidos.')
      // Do not report success if the browser rejects the write (e.g. quota exceeded).
      storage.setItem(STORAGE_KEY, JSON.stringify(draft))
      return structuredClone(draft)
    },
    reset(): DemoDatabase {
      storage.removeItem(STORAGE_KEY)
      return structuredClone(initial)
    },
  }
}