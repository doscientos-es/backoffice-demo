/**
 * Social Hub — shared Meta Graph client.
 *
 * A thin GET/POST wrapper over graph.facebook.com used by BOTH the Instagram
 * and Facebook publishers (same API surface, same token). Mirrors the retry /
 * timeout discipline of lib/integrations/meta-marketing.ts but adds POST (for
 * publishing) and single-object GET (not paginated lists).
 *
 * Publishing to a Page or its linked IG account requires the PAGE token, so we
 * resolve it explicitly here rather than falling back to the user token.
 */
import { serverEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { PublishError } from '@/lib/social/core'

const log = scopedLogger('social-meta')

const REQUEST_TIMEOUT_MS = 60_000 // uploads/containers can be slow
const MAX_ATTEMPTS = 4
const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENETUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
])

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return true
  const cause = (err as { cause?: unknown }).cause
  const code =
    (cause && typeof cause === 'object' && 'code' in cause
      ? (cause as { code?: unknown }).code
      : undefined) ?? (err as { code?: unknown }).code
  return typeof code === 'string' && TRANSIENT_NET_CODES.has(code)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Page access token used for all publishing/read calls. Empty when unset. */
export function metaPageToken(): string {
  return serverEnv().META_PAGE_ACCESS_TOKEN ?? ''
}

function graphBase(): string {
  return `https://graph.facebook.com/${serverEnv().META_GRAPH_API_VERSION}`
}

async function requestWithRetry(url: string, init: RequestInit, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250)
      log.warn({ status: res.status, attempt, delay }, 'Meta Graph transient HTTP, retrying')
      await sleep(delay)
      return requestWithRetry(url, init, attempt + 1)
    }
    return res
  } catch (err) {
    if (isTransientNetworkError(err) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250)
      log.warn({ err, attempt, delay }, 'Meta Graph transient network error, retrying')
      await sleep(delay)
      return requestWithRetry(url, init, attempt + 1)
    }
    throw err
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  const body = await res.text()
  if (!res.ok) {
    // Meta returns { error: { message, code, ... } } as JSON.
    let message = body.slice(0, 500)
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      /* keep raw body slice */
    }
    throw new PublishError('facebook', `Meta Graph ${res.status}: ${message}`)
  }
  return (body ? JSON.parse(body) : {}) as T
}

/** GET a single Graph object (fields via params). */
export async function graphGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${graphBase()}/${path}`)
  url.searchParams.set('access_token', metaPageToken())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await requestWithRetry(url.toString(), { method: 'GET' })
  return parseOrThrow<T>(res)
}

/** POST to a Graph edge with form-encoded params (token injected). */
export async function graphPost<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const body = new URLSearchParams()
  body.set('access_token', metaPageToken())
  for (const [k, v] of Object.entries(params)) body.set(k, v)
  const res = await requestWithRetry(`${graphBase()}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  return parseOrThrow<T>(res)
}

/** DELETE a Graph object (post, media…). Throws PublishError on failure. */
export async function graphDelete(path: string): Promise<void> {
  const url = new URL(`${graphBase()}/${path}`)
  url.searchParams.set('access_token', metaPageToken())
  const res = await requestWithRetry(url.toString(), { method: 'DELETE' })
  await parseOrThrow<unknown>(res)
}

/** GET a paginated edge, following `paging.next` until exhausted. */
export async function graphGetList<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const first = new URL(`${graphBase()}/${path}`)
  first.searchParams.set('access_token', metaPageToken())
  for (const [k, v] of Object.entries(params)) first.searchParams.set(k, v)

  const out: T[] = []
  let next: string | null = first.toString()
  while (next) {
    const res = await requestWithRetry(next, { method: 'GET' })
    const data = await parseOrThrow<{ data?: T[]; paging?: { next?: string } }>(res)
    if (data.data?.length) out.push(...data.data)
    next = data.paging?.next ?? null
  }
  return out
}
