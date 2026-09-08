import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { uploadMedia } from '@/lib/social/storage'

/**
 * Social Hub — media upload endpoint.
 *
 * Accepts one or more files (`files` field, repeated) and returns the uploaded
 * MediaItem[] with public URLs. Kept as a route (not a server action) because
 * server actions can't stream raw File bytes through our JSON-only action
 * envelope — the compose client uploads here first, then submits the resulting
 * MediaItem[] to the `createPost` action.
 */
export const dynamic = 'force-dynamic'

const log = scopedLogger('social-upload')

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

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Añade al menos un archivo' }, { status: 400 })
  }
  if (files.length > 10) {
    return NextResponse.json({ error: 'Máximo 10 archivos' }, { status: 400 })
  }

  try {
    const media = await uploadMedia(files)
    return NextResponse.json({ media }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error subiendo media'
    log.error({ err }, 'upload_failed')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
