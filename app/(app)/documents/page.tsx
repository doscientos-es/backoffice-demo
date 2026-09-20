import type { Metadata } from 'next'

import { ListPage } from '@/components/layout/list-page'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { FileText, ShieldCheck } from 'lucide-react'
import { escapeIlike, parsePage, parseSortParam, parseStringParam } from '@/lib/utils/search-params'

export const metadata: Metadata = { title: 'Documentos · doscientos' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const DOCUMENT_SORT_COLUMNS = ['name', 'mime_type', 'size_bytes', 'created_at'] as const

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireUser()
  const sp = await searchParams
  const q = parseStringParam(sp, 'q')
  const page = parsePage(sp)
  const { sort, dir } = parseSortParam(sp, DOCUMENT_SORT_COLUMNS, 'created_at', 'desc')
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createServerClient()
  let query = supabase
    .from('attachments')
    .select('id, name, mime_type, size_bytes, created_at', { count: 'exact' })
    .is('deleted_at', null)

  if (q.length > 0) query = query.ilike('name', `%${escapeIlike(q)}%`)

  const ascending = sort !== 'created_at' ? dir !== 'desc' : false
  const { data, error, count } = await query
    .order(sort, { ascending, nullsFirst: false })
    .range(from, to)

  return (
    <ListPage
      title="Documentos"
      description="Consulta y localiza rápidamente los documentos compartidos en tus clientes y expedientes."
      summary={
        <Card className="border-primary/15 bg-primary/[0.03]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <FileText className="size-4" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium">Tu documentación, siempre localizada</p>
                <p className="text-muted-foreground mt-0.5 text-xs">Para subir un archivo, abre el cliente o expediente al que pertenece y arrástralo a su zona de documentos.</p>
              </div>
            </div>
            <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs"><ShieldCheck className="size-3.5" /> Acceso controlado</div>
          </CardContent>
        </Card>
      }
      empty={q ? 'Sin coincidencias.' : 'Aún no hay documentos.'}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      headers={[
        { label: 'Nombre', sortKey: 'name' },
        { label: 'Formato', sortKey: 'mime_type' },
        { label: 'Tamaño', sortKey: 'size_bytes' },
        { label: 'Subido', sortKey: 'created_at' },
      ]}
      exportFilename="documentos"
      rows={
        data?.map((d) => ({
          id: d.id as string,
          href: `/documents/${d.id}`,
          cells: [
            d.name as string,
            (d.mime_type as string | null) ?? null,
            d.size_bytes ? `${Math.ceil(Number(d.size_bytes) / 1024)} KB` : null,
            formatDate(d.created_at as string),
          ],
          csvValues: [
            d.name as string,
            (d.mime_type as string | null) ?? '',
            d.size_bytes ? Math.ceil(Number(d.size_bytes) / 1024) : 0,
            d.created_at as string,
          ],
        })) ?? []
      }
    />
  )
}
