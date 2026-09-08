import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { listProjects } from '@/lib/projects/queries'
import { PROJECT_LIST_PAGE_SIZE, PROJECT_SORT_COLUMNS } from '@/lib/projects/types'
import { parsePage, parseSortParam, parseStringParam } from '@/lib/utils/search-params'

import { GitHubModeBadge } from './github-mode-badge'
import type { GitHubSyncMode } from './github-sync-section'
import { ProjectsList } from './projects-list'

export const metadata: Metadata = { title: 'Proyectos · doscientos' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planificado' },
  { value: 'active', label: 'Activo' },
  { value: 'on_hold', label: 'En pausa' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
]

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const canEdit = user.role !== 'viewer'
  const sp = await searchParams
  const q = parseStringParam(sp, 'q')
  const status = parseStringParam(sp, 'status')
  const page = parsePage(sp)
  const { sort, dir } = parseSortParam(sp, PROJECT_SORT_COLUMNS, 'updated_at', 'desc')

  const { data, count } = await listProjects({ q, status, page, sort, dir })

  return (
    <ProjectsList
      canEdit={canEdit}
      title="Proyectos"
      empty={q || status ? 'Sin coincidencias.' : 'Aún no hay proyectos.'}
      error={undefined}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      filters={[{ key: 'status', label: 'Estado', options: STATUS_OPTIONS }]}
      pagination={{ page, pageSize: PROJECT_LIST_PAGE_SIZE, total: count }}
      addHref="/projects/new"
      addLabel="Nuevo proyecto"
      actions={
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Link>
        </Button>
      }
      emptyAction={
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            Crear primer proyecto
          </Link>
        </Button>
      }
      headers={[
        { label: 'Nombre', sortKey: 'name' },
        'Cliente',
        { label: 'Estado', sortKey: 'status' },
        'GitHub',
      ]}
      exportFilename="proyectos"
      rows={data.map((p) => {
        const mode = (p.github_sync_mode as GitHubSyncMode | null) ?? 'none'
        return {
          id: p.id,
          href: `/projects/${p.id}`,
          data: {
            id: p.id,
            name: p.name,
            client_name: p.client_name ?? '—',
            status: p.status,
            description: p.description,
            updated_at: p.updated_at,
            github_sync_mode: mode,
            github_repo: p.github_repo,
          },
          cells: [
            p.name,
            p.client_name ?? '—',
            p.status as string,
            <GitHubModeBadge key="gh" mode={mode} />,
          ],
          csvValues: [p.name, p.client_name ?? '', p.status ?? '', mode],
        }
      })}
    />
  )
}
