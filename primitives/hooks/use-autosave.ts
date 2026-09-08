'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type AutosaveState = {
  status: AutosaveStatus
  /** Timestamp (ms) of the last successful save, if any. */
  savedAt: number | null
  /** Error message when status === 'error'. */
  error: string | null
}

export type UseAutosaveOptions<T> = {
  /** Reactive payload. Each change triggers a debounced save. */
  data: T
  /** Called once the debounce elapses. Must return a `{ error }` on failure or void/undefined on success. */
  onSaveAction: (data: T) => Promise<{ error?: string } | undefined>
  /** Debounce in ms before flushing the pending value. Defaults to 2000 ms. */
  debounceMs?: number
  /** Disable autosave (e.g. while loading initial data). */
  enabled?: boolean
  /** Stable key used to compare two snapshots. Defaults to JSON.stringify. */
  serializeAction?: (data: T) => string
  /** Optional localStorage key to queue the last unsaved snapshot until the next successful save. */
  storageKey?: string
}

/**
 * Debounced autosave hook.
 *
 * - Triggers `onSaveAction(data)` after `debounceMs` ms of inactivity.
 * - Skips identical snapshots so unchanged renders don't re-save.
 * - When `storageKey` is set, the pending snapshot is mirrored to localStorage
 *   and cleared on a successful save (so a hard refresh can recover edits).
 * - Exposes `status`, `savedAt`, `error` and a `saveNow()` helper.
 */
export function useAutosave<T>({
  data,
  onSaveAction,
  debounceMs = 2000,
  enabled = true,
  serializeAction = (d: T) => JSON.stringify(d),
  storageKey,
}: UseAutosaveOptions<T>) {
  const [state, setState] = useState<AutosaveState>({
    status: 'idle',
    savedAt: null,
    error: null,
  })

  const onSaveRef = useRef(onSaveAction)
  const serializeRef = useRef(serializeAction)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSnapshotRef = useRef<string | null>(null)
  const pendingSnapshotRef = useRef<string | null>(null)
  const pendingPayloadRef = useRef<{ value: T } | null>(null)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    onSaveRef.current = onSaveAction
    serializeRef.current = serializeAction
  }, [onSaveAction, serializeAction])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const flush = useCallback(
    async (snapshot: string, payload: T) => {
      if (inFlightRef.current) {
        pendingSnapshotRef.current = snapshot
        pendingPayloadRef.current = { value: payload }
        return
      }
      inFlightRef.current = true
      setState((s) => ({ ...s, status: 'saving', error: null }))

      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, snapshot)
        } catch {
          /* ignore */
        }
      }

      let errorMessage: string | null = null
      try {
        const result = await onSaveRef.current(payload)
        if (result && 'error' in result && result.error) errorMessage = result.error
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Error guardando'
      }

      inFlightRef.current = false
      if (!mountedRef.current) return

      if (errorMessage) {
        setState({ status: 'error', savedAt: null, error: errorMessage })
        return
      }

      lastSavedSnapshotRef.current = snapshot
      setState({ status: 'saved', savedAt: Date.now(), error: null })
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(storageKey)
        } catch {
          /* ignore */
        }
      }

      const next = pendingSnapshotRef.current
      const nextPayload = pendingPayloadRef.current
      pendingSnapshotRef.current = null
      pendingPayloadRef.current = null
      if (next && nextPayload && next !== lastSavedSnapshotRef.current) {
        void flush(next, nextPayload.value)
      }
    },
    [storageKey],
  )

  useEffect(() => {
    if (!enabled) return
    const snapshot = serializeRef.current(data)
    if (lastSavedSnapshotRef.current === null) {
      lastSavedSnapshotRef.current = snapshot
      return
    }
    if (snapshot === lastSavedSnapshotRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void flush(snapshot, data)
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [data, enabled, debounceMs, flush])

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const snapshot = serializeRef.current(data)
    if (snapshot === lastSavedSnapshotRef.current) return
    await flush(snapshot, data)
  }, [data, flush])

  return { ...state, saveNow }
}
