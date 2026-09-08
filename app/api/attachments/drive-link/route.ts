/**
 * POST /api/attachments/drive-link
 *
 * Vincula un fichero de Google Drive existente como adjunto — se guarda solo
 * la referencia (fileId + webViewLink), nunca una copia del contenido. La UI
 * abre `web_view_link` directamente en Drive/Docs en vez de descargar nada.
 *
 * Body: { drive_url: string; entityType: "lead"|"project"|"proposal"|"client"|"expense"; entityId: string }
 * Auth: requireUser (viewer denegado)
 * Returns: { id: string }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { isGoogleEnabled } from '@/lib/env'
import { resolveSubject } from '@/lib/google/client'
import { extractDriveFileId, getFileMetadata } from '@/lib/google/drive'
import { scopedLogger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('attachments.drive-link')

const ENTITY_FIELDS = ['lead_id', 'project_id', 'proposal_id', 'client_id', 'expense_id'] as const
type EntityField = (typeof ENTITY_FIELDS)[number]
const ENTITY_TYPE_MAP: Record<string, EntityField> = {
  lead: 'lead_id',
  project: 'project_id',
  proposal: 'proposal_id',
  client: 'client_id',
  expense: 'expense_id',
}

const BodySchema = z.object({
  drive_url: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isGoogleEnabled()) {
    return NextResponse.json({ error: 'google_disabled' }, { status: 503 })
  }

  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const entityField = ENTITY_TYPE_MAP[body.entityType]
  if (!entityField) {
    return NextResponse.json({ error: 'entityType inválido' }, { status: 400 })
  }

  const fileId = extractDriveFileId(body.drive_url)
  if (!fileId) {
    return NextResponse.json(
      { error: 'URL de Drive no válida. Pega la URL completa del documento.' },
      { status: 400 },
    )
  }

  const subject = resolveSubject(user.email)

  let metadata: Awaited<ReturnType<typeof getFileMetadata>>
  try {
    metadata = await getFileMetadata(subject, fileId)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al leer la metadata del documento de Drive'
    log.error({ fileId, err: message }, 'drive_link_metadata_failed')
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const supabase = await createServerClient()
  const { data, error: dbError } = await supabase
    .from('attachments')
    .insert({
      name: metadata.name,
      mime_type: metadata.mimeType,
      source: 'drive',
      drive_file_id: metadata.id,
      web_view_link: metadata.webViewLink,
      uploaded_by: user.id,
      [entityField]: body.entityId,
    })
    .select('id')
    .single()

  if (dbError || !data) {
    return NextResponse.json({ error: dbError?.message ?? 'Error al guardar' }, { status: 500 })
  }

  log.info({ fileId, userId: user.id }, 'drive_link_created')
  return NextResponse.json({ id: data.id as string }, { status: 201 })
}
