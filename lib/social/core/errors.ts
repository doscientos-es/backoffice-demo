/**
 * Social Hub — domain errors.
 *
 * A small, typed hierarchy so callers (server actions, orchestrator) can react
 * to *why* something failed without string-matching messages. All extend
 * {@link SocialError} for a single `instanceof` catch-all.
 */
import type { SocialPlatform } from './types'

export class SocialError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** A platform is selected but its credentials/env are not configured. */
export class NotConfiguredError extends SocialError {
  constructor(
    readonly platform: SocialPlatform,
    detail?: string,
  ) {
    super(detail ?? `${platform} no está configurado. Añade sus credenciales en el entorno.`)
  }
}

/** The post's media/shape is not publishable on this platform. */
export class UnsupportedMediaError extends SocialError {
  constructor(
    readonly platform: SocialPlatform,
    reason: string,
  ) {
    super(reason)
  }
}

/** The remote API rejected the publish (wraps the upstream message). */
export class PublishError extends SocialError {
  constructor(
    readonly platform: SocialPlatform,
    reason: string,
  ) {
    super(reason)
  }
}

/** Narrow unknown thrown values to a human-readable message. */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : 'Error desconocido'
}
