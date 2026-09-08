/**
 * Raised when a record changed after a user opened its editor. The action
 * wrapper turns it into a structured, safe-to-display result for clients.
 */
export class VersionConflictError extends Error {
  readonly code = 'conflict' as const

  constructor() {
    super('Este registro ha cambiado mientras lo editabas.')
    this.name = 'VersionConflictError'
  }
}

export function isVersionConflictError(error: unknown): error is VersionConflictError {
  return error instanceof VersionConflictError
}
