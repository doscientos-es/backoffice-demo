import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { indexInternalDocument } from '@/lib/internal-documents'
import { INTERNAL_DOC_MAX_SIZE_BYTES } from '@/lib/schemas/internal-doc'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

/**
 * Replace the underlying file of an internal document, bumping its version
 * and recording a `file_replaced` event. Metadata is edited separately via
 * the `updateInternalDoc` server action.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerClient()

  const { data: doc, error: fetchError } = await supabase
    .from('internal_documents')
    .select('id, category, storage_path, version, mime_type, size_bytes, visibility, deleted_at')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !doc || doc.deleted_at) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  // admins_only documents are only editable by owner/admin.
  if ((doc.visibility as string) === 'admins_only' && !['owner', 'admin'].includes(user.role)) {
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

  const oldPath = doc.storage_path as string
  const oldVersion = Number(doc.version) || 1
  const nextVersion = oldVersion + 1
  const safeFilename = sanitizeFilename(file.name || 'archivo')
  const newPath = `${doc.category}/${id}/v${nextVersion}-${safeFilename}`

  const storage = getStorage()
  const bytes = await file.arrayBuffer()

  const { error: storageError } = await storage.upload('internal-docs', newPath, bytes, {
    contentType: file.type || 'application/octet-stream',
  })

  if (storageError) {
    return NextResponse.json({ error: storageError }, { status: 500 })
  }

  const { error: dbError } = await supabase
    .from('internal_documents')
    .update({
      storage_path: newPath,
      mime_type: file.type || null,
      size_bytes: file.size,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (dbError) {
    // Roll back the newly uploaded object so we don't orphan it.
    await storage.remove('internal-docs', [newPath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Best-effort: drop the previous file now that the row points elsewhere.
  if (oldPath && oldPath !== newPath) {
    await storage.remove('internal-docs', [oldPath])
  }

  // Audit trail (best-effort).
  await supabase.from('internal_document_events').insert({
    document_id: id,
    action: 'file_replaced',
    actor_id: user.id,
    payload: {
      from: {
        filename: oldPath.split('/').pop() ?? null,
        size: doc.size_bytes ?? null,
        version: oldVersion,
      },
      to: { filename: safeFilename, size: file.size, version: nextVersion },
    },
  })

  await indexInternalDocument({
    documentId: id,
    version: nextVersion,
    mimeType: file.type || null,
    bytes,
  })

  return NextResponse.json({ ok: true, version: nextVersion }, { status: 200 })
}
