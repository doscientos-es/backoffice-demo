import { revalidatePath } from 'next/cache'
import type { z } from 'zod'

import { type CurrentUser, type MemberRole, requireRole, requireUser } from '@/lib/auth'
import { isVersionConflictError } from '@/lib/concurrency/version-conflict'
import { scopedLogger } from '@/lib/logger'
import { formDataToObject } from '@/lib/schemas/common'

import type { ActionResult } from './types'

/**
 * Re-throw markers used by Next.js for redirect / notFound flow control.
 * These MUST propagate or the framework can't perform the navigation.
 */
function isFrameworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const digest = (err as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.startsWith('NEXT_')
}

export type ActionContext = { user: CurrentUser }

export type DefineActionOptions<TSchema extends z.ZodTypeAny, TPayload> = {
  /** Stable name used for the scoped logger (e.g. "clients.update"). */
  name: string
  /** Zod schema for the input. Omit for actions that take no payload. */
  schema?: TSchema
  /** Restrict to these roles. When omitted, only `requireUser` is enforced. */
  roles?: MemberRole[]
  /** Paths to revalidate on success. Strings or `() => string[]`. */
  revalidate?: string[] | ((payload: TPayload, input: z.infer<TSchema>) => string[])
  /** The actual business logic. May throw `redirect()` / `notFound()`. */
  handler: (input: z.infer<TSchema>, ctx: ActionContext) => Promise<TPayload>
}

type Input<TSchema extends z.ZodTypeAny> = z.input<TSchema> | FormData

/**
 * Wraps a server action with: auth guard, Zod validation, structured logging,
 * uniform error envelope, and revalidation.
 *
 * The returned function is a server action that takes either the parsed input
 * shape or a `FormData` instance (auto-converted). Errors are returned as
 * `{ ok: false, error }`. `redirect()` / `notFound()` thrown inside the
 * handler propagate as-is so Next.js can perform navigation.
 */
export function defineAction<TSchema extends z.ZodTypeAny, TPayload>(
  options: DefineActionOptions<TSchema, TPayload>,
) {
  const log = scopedLogger(`action.${options.name}`)

  return async (rawInput?: Input<TSchema>): Promise<ActionResult<TPayload>> => {
    const fail = (error: string): ActionResult<TPayload> =>
      ({ ok: false, error }) as ActionResult<TPayload>

    try {
      const user = options.roles ? await requireRole(options.roles) : await requireUser()

      let input: z.infer<TSchema>
      if (options.schema) {
        const candidate: unknown =
          typeof FormData !== 'undefined' && rawInput instanceof FormData
            ? formDataToObject(rawInput)
            : (rawInput ?? {})
        const parsed = options.schema.safeParse(candidate)
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? 'Datos no válidos'
          log.warn({ issues: parsed.error.issues }, 'validation failed')
          return fail(msg)
        }
        input = parsed.data
      } else {
        input = undefined as z.infer<TSchema>
      }

      const payload = await options.handler(input, { user })

      const paths =
        typeof options.revalidate === 'function'
          ? options.revalidate(payload, input)
          : (options.revalidate ?? [])
      for (const p of paths) revalidatePath(p)

      return (
        payload === undefined ? { ok: true } : { ok: true, ...payload }
      ) as ActionResult<TPayload>
    } catch (err) {
      if (isFrameworkError(err)) throw err
      if (isVersionConflictError(err)) {
        return { ok: false, code: 'conflict', error: err.message } as ActionResult<TPayload>
      }
      const message = err instanceof Error ? err.message : 'Error desconocido'
      log.error({ err }, 'action failed')
      return fail(message)
    }
  }
}
