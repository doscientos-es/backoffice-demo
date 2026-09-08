import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_SIZE_BYTES = 52_428_800 // 50 MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
]

const ENTITY_FIELDS = ['lead_id', 'project_id', 'proposal_id', 'client_id', 'expense_id'] as const
type EntityField = (typeof ENTITY_FIELDS)[number]
const ENTITY_TYPE_MAP: Record<string, EntityField> = {
  lead: 'lead_id',
  project: 'project_id',
  proposal: 'proposal_id',
  client: 'client_id',
  expense: 'expense_id',
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el límite de 50 MB' }, { status: 413 })
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido (${file.type})` },
      { status: 400 },
    )
  }

  const entityType = (formData.get('entityType') as string | null) ?? null
  const entityId = (formData.get('entityId') as string | null) ?? null
  const name = ((formData.get('name') as string | null) ?? file.name).trim() || file.name

  const entityField: EntityField | null =
    entityType && entityId ? (ENTITY_TYPE_MAP[entityType] ?? null) : null

  if (entityType && !entityField) {
    return NextResponse.json({ error: 'entityType inválido' }, { status: 400 })
  }

  const attachmentId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(file.name || 'archivo')
  const folder = entityType && entityId ? `${entityType}/${entityId}` : 'misc'
  const storagePath = `${folder}/${attachmentId}/${safeFilename}`

  const storage = getStorage()
  const bytes = await file.arrayBuffer()

  const { error: storageError } = await storage.upload('documents', storagePath, bytes, {
    contentType: file.type || 'application/octet-stream',
  })

  if (storageError) {
    return NextResponse.json({ error: storageError }, { status: 500 })
  }

  const supabase = await createServerClient()
  const { data, error: dbError } = await supabase
    .from('attachments')
    .insert({
      id: attachmentId,
      name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: user.id,
      ...(entityField && entityId ? { [entityField]: entityId } : {}),
    })
    .select('id')
    .single()

  if (dbError || !data) {
    await storage.remove('documents', [storagePath])
    return NextResponse.json({ error: dbError?.message ?? 'Error al guardar' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id as string }, { status: 201 })
}
