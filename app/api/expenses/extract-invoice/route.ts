import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { extractExpenseInvoice } from '@/lib/finance/invoice-extraction'
import { scopedLogger } from '@/lib/logger'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('expenses.extract-invoice')
const BodySchema = z.object({ attachment_id: z.string().uuid() })

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Adjunto inválido' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: attachment, error } = await supabase
    .from('attachments')
    .select('id, expense_id, mime_type, storage_path')
    .eq('id', body.attachment_id)
    .not('expense_id', 'is', null)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !attachment)
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  if (attachment.mime_type !== 'application/pdf' || !attachment.storage_path) {
    return NextResponse.json({ error: 'Selecciona un PDF subido al gasto' }, { status: 400 })
  }

  const { data, error: downloadError } = await getStorage().download(
    'documents',
    attachment.storage_path,
  )
  if (downloadError || !data)
    return NextResponse.json({ error: 'No se pudo leer el PDF' }, { status: 502 })

  try {
    const result = await extractExpenseInvoice(data)
    log.info({ attachmentId: attachment.id, source: result.source }, 'expense_invoice_extracted')
    return NextResponse.json(result)
  } catch (err) {
    log.error({ attachmentId: attachment.id, err }, 'expense_invoice_extraction_failed')
    return NextResponse.json(
      { error: 'No se pudieron extraer los datos de la factura' },
      { status: 422 },
    )
  }
}
