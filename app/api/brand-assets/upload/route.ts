import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_SIZE_BYTES = 20_971_520 // 20 MB
const BUCKET = 'brand-assets'

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']

const ALLOWED_CATEGORIES = ['logo', 'isotipo', 'background', 'banner', 'other'] as const
type AssetCategory = (typeof ALLOWED_CATEGORIES)[number]

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_')
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
    return NextResponse.json({ error: 'El archivo supera el límite de 20 MB' }, { status: 413 })
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido (${file.type})` },
      { status: 400 },
    )
  }

  const rawCategory = (formData.get('category') as string | null) ?? 'other'
  const category: AssetCategory = ALLOWED_CATEGORIES.includes(rawCategory as AssetCategory)
    ? (rawCategory as AssetCategory)
    : 'other'

  const name = ((formData.get('name') as string | null) ?? file.name).trim() || file.name
  const description = (formData.get('description') as string | null)?.trim() || null

  const assetId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(file.name || 'asset')
  const storagePath = `${category}/${assetId}/${safeFilename}`

  const admin = createAdminClient()
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  const supabase = await createServerClient()
  const { data, error: dbError } = await supabase
    .from('brand_assets')
    .insert({
      id: assetId,
      name,
      description,
      category,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
      public_url: publicUrl,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (dbError || !data) {
    // Best-effort rollback
    await admin.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: dbError?.message ?? 'Error al guardar' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id as string, public_url: publicUrl }, { status: 201 })
}
