/**
 * POST /api/crm/meet-notes
 *
 * Lee el texto de un documento Google Drive (p.ej. las notas de IA que Google
 * Meet genera tras la llamada y guarda en Drive) y lo devuelve como string.
 *
 * Body: { drive_url: string }  — URL completa o file ID del documento
 * Auth: requireUser (viewer denegado)
 * Returns: { text: string }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { isGoogleEnabled } from '@/lib/env'
import { resolveSubject } from '@/lib/google/client'
import { extractDriveFileId, readDocumentText } from '@/lib/google/drive'
import { scopedLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('crm.meet-notes')

const BodySchema = z.object({
  drive_url: z.string().min(1),
})

export async function POST(req: NextRequest) {
  if (!isGoogleEnabled()) {
    return NextResponse.json({ error: 'google_disabled' }, { status: 503 })
  }

  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'drive_url is required' }, { status: 400 })
  }

  const fileId = extractDriveFileId(body.drive_url)
  if (!fileId) {
    return NextResponse.json(
      { error: 'URL de Drive no válida. Pega la URL completa del documento.' },
      { status: 400 },
    )
  }

  const subject = resolveSubject(user.email)

  try {
    const text = await readDocumentText(subject, fileId)
    log.info({ fileId, userId: user.id }, 'meet_notes_fetched')
    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al leer el documento de Drive'
    log.error({ fileId, err: message }, 'meet_notes_failed')
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
