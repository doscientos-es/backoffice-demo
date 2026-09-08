import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ListPage } from '@/components/layout/list-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Docs internos · doscientos' }
export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Legal',
  hr: 'RRHH',
  finance: 'Finanzas',
  templates: 'Plantillas',
  policies: 'Políticas',
  meetings: 'Actas',
  other: 'Otro',
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const PAGE_SIZE = 30

function escapeIlike(v: string) {
  return v.replace(/[%_\\]/g, (m) => `\\${m}`)
}

export default async function InternalDocsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireUser()
  const sp = await searchParams

  const q = (sp.q ?? '').trim()
  const category = sp.category ?? ''
  const page = Math.max(1, Number(sp.page ?? '1') || 1)
  const from = (page - 1) * PAGE_SIZE

  const supabase = await createServerClient()

  let query = supabase
    .from('internal_documents')
    .select('id, name, category, mime_type, size_bytes, visibility, created_at, uploaded_by', {
      count: 'exact',
    })
    .is('deleted_at', null)

  if (q) query = query.ilike('name', `%${escapeIlike(q)}%`)
  if (category) query = query.eq('category', category)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  return (
    <ListPage
      title="Docs internos"
      description="Documentación interna de la empresa: políticas, contratos, plantillas y más."
      empty={q || category ? 'Sin coincidencias.' : 'Aún no hay documentos internos.'}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      filters={[{ key: 'category', label: 'Categoría', options: CATEGORY_OPTIONS }]}
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      actions={
        <Button asChild size="sm">
          <Link href="/internal-docs/new">
            <Plus className="h-4 w-4" />
            Subir documento
          </Link>
        </Button>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/internal-docs/new">Subir primer documento</Link>
        </Button>
      }
      addHref="/internal-docs/new"
      addLabel="Subir documento"
      headers={['Nombre', 'Categoría', 'Tamaño', 'Visibilidad', 'Subido']}
      rows={
        data?.map((d) => ({
          id: d.id as string,
          href: `/internal-docs/${d.id}`,
          cells: [
            d.name as string,
            CATEGORY_LABELS[(d.category as string) ?? 'other'] ?? 'Otro',
            d.size_bytes ? `${Math.ceil(Number(d.size_bytes) / 1024)} KB` : '—',
            (d.visibility as string) === 'admins_only' ? (
              <Badge variant="warning" key="vis">
                Solo admin
              </Badge>
            ) : (
              <Badge variant="neutral" key="vis">
                Equipo
              </Badge>
            ),
            formatDate(d.created_at as string),
          ],
        })) ?? []
      }
    />
  )
}
