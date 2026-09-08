/**
 * Standard discriminated-union result type for operations that can succeed or fail.
 *
 *   const res = await someAction(input);
 *   if (!res.ok) return handleError(res.error);
 *
 * Payload-carrying success can extend the success branch via the generic:
 *   ActionResult<{ id: string }>  →  { ok: true; id: string } | { ok: false; error: string }
 */
export type ActionFailure = {
  ok: false
  error: string
  /** A stale edit was rejected without modifying the stored record. */
  code?: 'conflict'
}

export type ActionResult<T = unknown> = T extends undefined | undefined
  ? { ok: true } | ActionFailure
  : ({ ok: true } & T) | ActionFailure
