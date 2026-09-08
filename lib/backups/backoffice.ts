export const BACKOFFICE_BACKUP_SLUG = 'doscientos-backoffice'

export type BackofficeBackupSetup = { configured: false; missing: string[] }

export function getBackofficeBackupSetup(_settings?: unknown): BackofficeBackupSetup {
  return { configured: false, missing: ['Demo local: no se configuran backups remotos'] }
}

export function buildBackofficeBackupPayload(_setup: BackofficeBackupSetup) {
  return {
    clientSlug: BACKOFFICE_BACKUP_SLUG,
    mode: 'local-demo',
    available: false,
  }
}

export function isBackofficeBackupConfigured(): boolean {
  return false
}

/** Remote backups are deliberately unavailable in the standalone demo. */
export async function runBackofficeBackup(): Promise<void> {
  throw new Error('Los backups remotos no están disponibles en la demo local.')
}
