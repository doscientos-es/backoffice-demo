'use server'

import { revalidateTag } from 'next/cache'

import { requireRole } from '@/lib/auth'
import { BACKOFFICE_BACKUP_SLUG, runBackofficeBackup } from '@/lib/backups/backoffice'
import { backupsCacheTag } from '@/lib/filebrowser'

export async function triggerBackofficeBackup(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await requireRole(['owner', 'admin'])
    await runBackofficeBackup()
    revalidateTag(backupsCacheTag(BACKOFFICE_BACKUP_SLUG), 'default')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo crear el backup',
    }
  }
}
