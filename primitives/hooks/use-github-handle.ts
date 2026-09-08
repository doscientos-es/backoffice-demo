'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * GitHub username rules:
 * - alphanumeric or single hyphens
 * - cannot begin/end with hyphen
 * - 1..39 chars
 */
const HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/

export type GithubHandleStatus =
  | 'empty'
  | 'invalid'
  | 'checking'
  | 'valid'
  | 'not_found'
  | 'rate_limited'
  | 'error'

export type GithubHandleState = {
  status: GithubHandleStatus
  /** Avatar URL returned by GitHub when status === "valid". */
  avatarUrl: string | null
  /** GitHub display name (or login fallback) when status === "valid". */
  displayName: string | null
}

type Options = {
  /** Debounce window before hitting the GitHub API. Defaults to 400 ms. */
  debounceMs?: number
}

const INITIAL: GithubHandleState = { status: 'empty', avatarUrl: null, displayName: null }

/**
 * Validates a GitHub handle against the public REST API with debounce + abort.
 *
 * - Returns `empty` for blank input (no network call).
 * - Returns `invalid` synchronously when the handle fails the regex.
 * - Otherwise debounces and calls `GET https://api.github.com/users/{handle}`.
 * - Always cancels the previous in-flight request when the input changes.
 */
export function useGithubHandle(handle: string, options: Options = {}): GithubHandleState {
  const debounceMs = options.debounceMs ?? 400
  const [state, setState] = useState<GithubHandleState>(INITIAL)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = handle.trim()
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (trimmed.length === 0) {
      setState(INITIAL)
      return
    }
    if (!HANDLE_RE.test(trimmed)) {
      setState({ status: 'invalid', avatarUrl: null, displayName: null })
      return
    }
    setState((prev) =>
      prev.status === 'valid' && prev.displayName?.toLowerCase() === trimmed.toLowerCase()
        ? prev
        : { status: 'checking', avatarUrl: null, displayName: null },
    )
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json' },
        })
        if (res.status === 404) {
          setState({ status: 'not_found', avatarUrl: null, displayName: null })
          return
        }
        if (res.status === 403 || res.status === 429) {
          setState({ status: 'rate_limited', avatarUrl: null, displayName: null })
          return
        }
        if (!res.ok) {
          setState({ status: 'error', avatarUrl: null, displayName: null })
          return
        }
        const data = (await res.json()) as {
          login?: string
          name?: string | null
          avatar_url?: string
        }
        setState({
          status: 'valid',
          avatarUrl: data.avatar_url ?? null,
          displayName: data.name ?? data.login ?? trimmed,
        })
      } catch (err) {
        if ((err as { name?: string } | null)?.name === 'AbortError') return
        setState({ status: 'error', avatarUrl: null, displayName: null })
      }
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [handle, debounceMs])

  return state
}

/** Synchronous regex check. */
export function isValidGithubHandleShape(handle: string): boolean {
  return HANDLE_RE.test(handle.trim())
}
