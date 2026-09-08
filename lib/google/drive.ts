/**
 * Backups a Google Drive vía service account.
 *
 * Sube un buffer (PDF de factura, snapshot JSON de propuesta, etc.) a la carpeta
 * de backups, actuando como un usuario del dominio. Es best-effort: el caller
 * decide si un fallo aquí debe romper el flujo principal (normalmente NO).
 */
import { isGoogleEnabled } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'

import { GOOGLE_SCOPES, GOOGLE_TIMEOUT_MS, getGoogleClient, googleFetch } from './client'

const log = scopedLogger('google.drive')

const FILES_BASE = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_URL = `${FILES_BASE}?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`

/** Strip chars that Drive forbids in folder names and cap at 255. */
function toFolderName(raw: string): string {
  return (
    raw
      .trim()
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 255) || 'Sin-Nombre'
  )
}

/**
 * Returns the Drive ID of the `clientName` subfolder inside `parentFolderId`,
 * creating it if it doesn't exist. Idempotent. Lanza si la API falla.
 */
export async function findOrCreateClientFolder(opts: {
  subject: string
  parentFolderId: string
  clientName: string
}): Promise<string> {
  const { subject, parentFolderId, clientName } = opts
  const folderName = toFolderName(clientName)
  const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const q = `name = '${escapedName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  // `supportsAllDrives` + `includeItemsFromAllDrives` son obligatorios para que la
  // query alcance carpetas dentro de un Shared Drive (si no, devuelve vacío/404).
  const listParams = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })

  const list = await googleFetch<{ files?: Array<{ id: string }> }>(
    subject,
    [GOOGLE_SCOPES.drive],
    `${FILES_BASE}?${listParams}`,
  )
  const existing = list.files?.[0]
  if (existing) return existing.id

  const created = await googleFetch<{ id: string }>(
    subject,
    [GOOGLE_SCOPES.drive],
    `${FILES_BASE}?fields=id&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    },
  )
  return created.id
}

export type DriveUploadResult = { id: string; name: string; webViewLink: string | null }

export type UploadBackupInput = {
  /** Usuario @doscientos.es a impersonar (debe tener acceso a la carpeta). */
  subject: string
  /** Nombre del fichero en Drive, p.ej. "Factura F-2026-0001.pdf". */
  name: string
  /** MIME type, p.ej. "application/pdf" o "application/json". */
  mimeType: string
  /** Contenido del fichero. */
  data: Buffer
  /** Carpeta destino. Por defecto GOOGLE_DRIVE_BACKUP_FOLDER_ID. */
  folderId?: string
}

/**
 * Sube un fichero a Drive como backup. Lanza si Google no está configurado o la
 * API devuelve error — envuelve la llamada en try/catch en el call-site.
 */
export async function uploadBackup(input: UploadBackupInput): Promise<DriveUploadResult> {
  const folderId = input.folderId ?? ''
  const client = getGoogleClient(input.subject, [GOOGLE_SCOPES.drive])
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('No se pudo obtener el token de acceso de Google.')

  const metadata: Record<string, unknown> = { name: input.name, mimeType: input.mimeType }
  if (folderId) metadata.parents = [folderId]

  const boundary = `doscientos-${Date.now().toString(36)}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`),
    input.data,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body as unknown as BodyInit,
  })

  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message =
      (json as { error?: { message?: string } } | null)?.error?.message ?? `Drive API ${res.status}`
    throw new Error(message)
  }

  const result = json as { id: string; name: string; webViewLink?: string }
  return { id: result.id, name: result.name, webViewLink: result.webViewLink ?? null }
}

/**
 * Variante best-effort: sube y registra, pero nunca lanza. Devuelve el
 * resultado o `null` si Google está desactivado / la subida falla. Ideal para
 * hooks dentro de flujos críticos (aprobar propuesta, emitir factura).
 */
export async function uploadBackupSafe(
  input: UploadBackupInput,
): Promise<DriveUploadResult | null> {
  if (!isGoogleEnabled()) return null
  try {
    const result = await uploadBackup(input)
    log.info({ id: result.id, name: result.name }, 'drive_backup_uploaded')
    return result
  } catch (err) {
    log.error({ err, name: input.name }, 'drive_backup_failed')
    return null
  }
}

/**
 * Extrae el file ID de una URL de Google Drive / Docs.
 * Soporta:
 *   https://docs.google.com/document/d/{id}/edit
 *   https://drive.google.com/file/d/{id}/view
 *   Un file ID puro (solo alfanumérico + guiones)
 */
export function extractDriveFileId(input: string): string | null {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]{20,})/)
  if (match?.[1]) return match[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim()
  return null
}

export type DriveFileMetadata = {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
  iconLink: string | null
}

/**
 * Obtiene metadata de un fichero de Drive (nombre, mimeType, link) sin
 * descargar contenido. Usado al vincular un documento existente como
 * adjunto — solo se persiste la referencia, nunca una copia.
 *
 * Lanza si la API falla (404, sin permiso, etc.) — envuelve en try/catch en
 * el call-site.
 */
export async function getFileMetadata(subject: string, fileId: string): Promise<DriveFileMetadata> {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,webViewLink,iconLink,trashed',
    supportsAllDrives: 'true',
  })
  const result = await googleFetch<{
    id: string
    name: string
    mimeType: string
    webViewLink?: string
    iconLink?: string
    trashed?: boolean
  }>(subject, [GOOGLE_SCOPES.drive], `${FILES_BASE}/${encodeURIComponent(fileId)}?${params}`)

  if (result.trashed) {
    throw new Error('El archivo está en la papelera de Drive.')
  }

  return {
    id: result.id,
    name: result.name,
    mimeType: result.mimeType,
    webViewLink: result.webViewLink ?? null,
    iconLink: result.iconLink ?? null,
  }
}

/**
 * Exports a Google Doc (or any Drive file with text/plain export support) as
 * plain text. Useful to read AI-generated meeting notes that Google Meet saves
 * in Drive after a call.
 *
 * Lanza si la API falla — envuelve en try/catch en el call-site.
 */
export async function readDocumentText(subject: string, fileId: string): Promise<string> {
  const client = getGoogleClient(subject, [GOOGLE_SCOPES.drive])
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('No se pudo obtener el token de acceso de Google.')

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text%2Fplain&supportsAllDrives=true`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const text = await res.text()
      let message = `Drive API ${res.status}`
      try {
        const json = JSON.parse(text) as { error?: { message?: string } }
        message = json.error?.message ?? message
      } catch {
        // keep default message
      }
      throw new Error(message)
    }
    return await res.text()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('La API de Google tardó demasiado en responder (timeout 20s).')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
