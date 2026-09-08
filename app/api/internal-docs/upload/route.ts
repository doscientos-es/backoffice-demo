import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { indexInternalDocument } from '@/lib/internal-documents'
import {
  INTERNAL_DOC_CATEGORIES,
  INTERNAL_DOC_MAX_SIZE_BYTES,
  INTERNAL_DOC_VISIBILITIES,
  type InternalDocCategory,
  type InternalDocVisibility,
} from '@/lib/schemas/internal-doc'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

  // viewer cannot upload
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
  if (file.size > INTERNAL_DOC_MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el límite de 50 MB' }, { status: 413 })
  }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const rawCategory = (formData.get('category') as string | null) ?? 'other'
  if (!(INTERNAL_DOC_CATEGORIES as readonly string[]).includes(rawCategory)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  }
  const category = rawCategory as InternalDocCategory

  const rawVisibility = (formData.get('visibility') as string | null) ?? 'all_team'
  if (!(INTERNAL_DOC_VISIBILITIES as readonly string[]).includes(rawVisibility)) {
    return NextResponse.json({ error: 'Visibilidad inválida' }, { status: 400 })
  }
  const visibility = rawVisibility as InternalDocVisibility

  const description = (formData.get('description') as string | null)?.trim() || null
  const effective_date = (formData.get('effective_date') as string | null) || null
  const expires_at = (formData.get('expires_at') as string | null) || null

  const docId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(file.name || 'archivo')
  const storagePath = `${category}/${docId}/${safeFilename}`

  const storage = getStorage()
  const bytes = await file.arrayBuffer()

  const { error: storageError } = await storage.upload('internal-docs', storagePath, bytes, {
    contentType: file.type || 'application/octet-stream',
  })

  if (storageError) {
    return NextResponse.json({ error: storageError }, { status: 500 })
  }

  const supabase = await createServerClient()
  const { data, error: dbError } = await supabase
    .from('internal_documents')
    .insert({
      id: docId,
      name,
      description,
      category,
      visibility,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: storagePath,
      effective_date: effective_date || null,
      expires_at: expires_at || null,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (dbError || !data) {
    // Best-effort cleanup of orphaned storage object
    await storage.remove('internal-docs', [storagePath])
    return NextResponse.json({ error: dbError?.message ?? 'Error al guardar' }, { status: 500 })
  }

  // Audit trail: record creation (best-effort, never blocks the upload).
  await supabase.from('internal_document_events').insert({
    document_id: docId,
    action: 'created',
    actor_id: user.id,
    payload: { name, category, visibility, size_bytes: file.size },
  })

  await indexInternalDocument({
    documentId: docId,
    version: 1,
    mimeType: file.type || null,
    bytes,
  })

  return NextResponse.json({ id: data.id as string }, { status: 201 })
}
