import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from '@/lib/vault/crypto'

/** Decrypted DB connection credentials for a web project's backups. */
export type WebProjectDbCredentials = {
  host: string
  port: number
  name: string
  user: string
  password: string
}

/** Backup target ready to be sent to the runner. */
export type WebProjectBackupTarget = {
  id: string
  name: string
  backupSlug: string
  credentials: WebProjectDbCredentials
}

type CredentialRow = {
  db_host: string | null
  db_port: number | null
  db_name: string | null
  db_user: string | null
  db_pass_encrypted: string | null
}

type BackupTargetRow = CredentialRow & {
  id: string
  name: string
  backup_slug: string | null
}

/**
 * Maps a raw row to decrypted credentials, or null when the connection is
 * incomplete (missing host/name/user or no stored password).
 */
function rowToCredentials(row: CredentialRow): WebProjectDbCredentials | null {
  if (!row.db_host || !row.db_name || !row.db_user || !row.db_pass_encrypted) return null
  return {
    host: row.db_host,
    port: row.db_port ?? 5432,
    name: row.db_name,
    user: row.db_user,
    password: decryptSecret(row.db_pass_encrypted),
  }
}

/**
 * Reads one web project's DB credentials and decrypts the password.
 *
 * Server-only: called by the auth-gated `triggerWebBackup` server action, which
 * forwards the decrypted credentials to the backup runner. Uses the admin client
 * so the read doesn't depend on RLS. The plaintext password must never be
 * returned to the browser — only handed to the configured backup runner.
 */
export async function getWebProjectDbCredentials(
  id: string,
): Promise<WebProjectDbCredentials | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('web_projects')
    .select('db_host, db_port, db_name, db_user, db_pass_encrypted')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  return data ? rowToCredentials(data as CredentialRow) : null
}

/**
 * Reads all active web projects that have a backup slug and complete DB
 * credentials. Used by the weekly cron endpoint so scheduled backups follow
 * the Webs configuration in the backoffice.
 */
export async function getConfiguredWebBackupTargets(): Promise<WebProjectBackupTarget[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('web_projects')
    .select('id, name, backup_slug, db_host, db_port, db_name, db_user, db_pass_encrypted')
    .is('deleted_at', null)
    .not('backup_slug', 'is', null)

  if (error) throw new Error(error.message)

  return ((data ?? []) as BackupTargetRow[]).flatMap((row) => {
    const credentials = rowToCredentials(row)
    if (!row.backup_slug || !credentials) return []
    return [
      {
        id: row.id,
        name: row.name,
        backupSlug: row.backup_slug,
        credentials,
      },
    ]
  })
}
