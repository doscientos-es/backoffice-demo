import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Signed URL TTL in seconds (2 minutes – enough for browser to follow the redirect). */
const SIGNED_URL_TTL = 120

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params

  const supabase = await createServerClient()
  const { data: doc, error } = await supabase
    .from('internal_documents')
    .select('id, storage_path, name, visibility, deleted_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !doc || doc.deleted_at) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  // Visibility guard: admins_only → only owner/admin
  if ((doc.visibility as string) === 'admins_only' && !['owner', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Generate signed URL (admin-level access bypasses JWT expiry issues in Storage)
  const { url, error: signError } = await getStorage().createSignedUrl(
    'internal-docs',
    doc.storage_path as string,
    SIGNED_URL_TTL,
  )

  if (signError || !url) {
    return NextResponse.json({ error: 'No se pudo generar la URL de descarga' }, { status: 500 })
  }

  return NextResponse.redirect(url)
}
