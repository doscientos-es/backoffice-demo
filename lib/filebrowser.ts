/**
 * Local-only backup facade for the public demo.
 *
 * The production FileBrowser integration is intentionally unavailable here:
 * no credentials, URLs, requests, or remote files are used.
 */

export type FileBrowserItem = {
  name: string
  path: string
  size: number
  isDir: boolean
  modified: string
  type: string
}

export type FileBrowserListing = {
  name: string
  path: string
  isDir: boolean
  items: FileBrowserItem[]
}

/** The remote backup integration is always disabled in the local demo. */
export function isFileBrowserConfigured(): boolean {
  return false
}

/** Retained for cache-tag compatibility with existing backup views. */
export function backupsCacheTag(clientSlug: string): string {
  return `backups:${clientSlug}`
}

/** No directories are created outside the browser in demo mode. */
export async function ensureClientBackupDir(_clientSlug: string): Promise<boolean> {
  return false
}

/** Backup listings are deliberately empty because no remote service exists. */
export async function getClientBackups(
  _clientSlug: string,
  _subPath = '',
): Promise<FileBrowserListing | null> {
  return null
}

/** Demo mode never modifies or deletes files. */
export async function deleteClientBackup(_clientSlug: string, _filePath: string): Promise<boolean> {
  return false
}