import { TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'

import { ListControls } from '@/components/layout/list-controls'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty-state'
import { isAIEnabled } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { isGoogleEnabled } from '@/lib/env'
import { SELECTABLE_LEAD_STATUSES } from '@/lib/leads/pipeline'
import { listLeads } from '@/lib/leads/queries'
import {
  LEAD_BOARD_LIMIT,
  LEAD_LIST_PAGE_SIZE,
  LEAD_SORT_COLUMNS,
  type LeadAttentionFilter,
} from '@/lib/leads/types'
import { listActiveMembers } from '@/lib/members/queries'
import { LEAD_STATUS, type LeadStatus } from '@/lib/status'
import { parseSortParam } from '@/lib/utils/search-params'

import { LeadCreateDialog } from './lead-create-dialog'
import { LEAD_SOURCES, SOLUTION_TYPES } from './lead-form-fields'
import { LeadsKanban } from './leads-kanban'
import { LeadsList } from './leads-list'
import { LeadsViewToggle } from './view-toggle'

export const metadata: Metadata = { title: 'Leads · doscientos' }
export const dynamic = 'force-dynamic'

/** `qualifying` is omitted: it is folded into `in_conversation` when filtering. */
const STATUS_FILTER_OPTIONS = SELECTABLE_LEAD_STATUSES.map((value) => ({
  value,
  label: LEAD_STATUS[value].label,
}))

const SOURCE_FILTER_OPTIONS = LEAD_SOURCES.map((s) => ({ value: s, label: s }))
const SOLUTION_FILTER_OPTIONS = SOLUTION_TYPES.map((s) => ({ value: s, label: s }))

const ATTENTION_FILTER_OPTIONS: { value: LeadAttentionFilter; label: string }[] = [
  { value: 'stale', label: 'Estancados' },
  { value: 'unassigned', label: 'Sin responsable' },
  { value: 'urgent', label: 'Urgencia inmediata' },
]

const LEAD_SAVED_VIEW_FILTER_KEYS = ['q', 'status', 'source', 'solution', 'assignee', 'attention']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    q?: string
    status?: string
    source?: string
    solution?: string
    assignee?: string
    attention?: string
    ids?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const view: 'board' | 'list' = sp.view === 'list' ? 'list' : 'board'
  const q = (sp.q ?? '').trim()
  const status = (LEAD_STATUS as Record<string, unknown>)[sp.status ?? '']
    ? (sp.status as LeadStatus)
    : null
  const source = (LEAD_SOURCES as readonly string[]).includes(sp.source ?? '')
    ? (sp.source as string)
    : null
  const solutionType = (SOLUTION_TYPES as readonly string[]).includes(sp.solution ?? '')
    ? (sp.solution as string)
    : null
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const leadIds = [
    ...new Set((sp.ids ?? '').split(',').filter((id) => UUID_PATTERN.test(id))),
  ].slice(0, 25)
  const { sort, dir } = parseSortParam(sp, LEAD_SORT_COLUMNS, 'created_at', 'desc')

  const user = await requireUser()
  const aiEnabled = isAIEnabled()
  const googleEnabled = isGoogleEnabled()
  const canEdit = user.role !== 'viewer'

  const members = await listActiveMembers()
  const memberIds = new Set(members.map((m) => m.id))
  const assignee = memberIds.has(sp.assignee ?? '') ? (sp.assignee as string) : null
  const attention = ATTENTION_FILTER_OPTIONS.some((option) => option.value === sp.attention)
    ? (sp.attention as LeadAttentionFilter)
    : null

  const {
    leads: enrichedLeads,
    count,
    error,
  } = await listLeads({
    view,
    ids: leadIds,
    q,
    status,
    source,
    solutionType,
    assignee,
    attention,
    page,
    sort,
    dir,
  })

  const ASSIGNEE_FILTER_OPTIONS = members.map((m) => ({
    value: m.id,
    label: m.name,
    avatar: {
      name: m.name,
      avatar_url: m.avatar_url,
      github_handle: m.github_handle,
    },
  }))

  const boardCapped = view === 'board' && enrichedLeads.length >= LEAD_BOARD_LIMIT

  const actions = (
    <div className="flex items-center gap-2">
      <LeadsViewToggle view={view} />
      <LeadCreateDialog />
    </div>
  )

  if (view === 'list') {
    const hasFilters =
      leadIds.length > 0 ||
      q.length > 0 ||
      !!status ||
      !!source ||
      !!solutionType ||
      !!assignee ||
      !!attention
    return (
      <LeadsList
        leads={enrichedLeads}
        aiEnabled={aiEnabled}
        canEdit={canEdit}
        members={members}
        senderName={user.name}
        title={leadIds.length ? 'Leads pendientes del aviso' : 'Leads'}
        actions={actions}
        error={error ?? undefined}
        empty={hasFilters ? 'Sin coincidencias.' : 'Aún no hay leads.'}
        emptyAction={<LeadCreateDialog />}
        searchKey="q"
        searchPlaceholder="Buscar por nombre, empresa o email…"
        controlsPresentation="default"
        filters={[
          { key: 'status', label: 'Estado', options: STATUS_FILTER_OPTIONS },
          { key: 'source', label: 'Origen', options: SOURCE_FILTER_OPTIONS },
          { key: 'solution', label: 'Necesidad', options: SOLUTION_FILTER_OPTIONS },
          {
            key: 'assignee',
            label: 'Responsable',
            options: ASSIGNEE_FILTER_OPTIONS,
            display: 'avatars',
          },
          { key: 'attention', label: 'Atención', options: ATTENTION_FILTER_OPTIONS },
        ]}
        savedViews={{
          storageKey: 'leads:saved-views:v1',
          filterKeys: LEAD_SAVED_VIEW_FILTER_KEYS,
        }}
        pagination={{ page, pageSize: LEAD_LIST_PAGE_SIZE, total: count }}
        headers={[
          { label: 'Nombre', sortKey: 'name' },
          { label: 'Empresa', sortKey: 'company' },
          'Email',
          'Campaña',
          { label: 'Estado', sortKey: 'status' },
          { label: 'Score', sortKey: 'score' },
          'Responsable',
          { label: 'Creado', sortKey: 'created_at' },
          'Acciones',
        ]}
        align={['left', 'left', 'left', 'left', 'left', 'right', 'left', 'left', 'right']}
        exportFilename="leads"
        addHref="/leads/new"
        addLabel="Añadir lead"
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <PageHeader title="Leads" actions={actions} />

      <ListControls
        searchKey="q"
        searchPlaceholder="Buscar por nombre, empresa, email o teléfono…"
        presentation="default"
        filters={[
          { key: 'source', label: 'Origen', options: SOURCE_FILTER_OPTIONS },
          { key: 'solution', label: 'Necesidad', options: SOLUTION_FILTER_OPTIONS },
          {
            key: 'assignee',
            label: 'Responsable',
            options: ASSIGNEE_FILTER_OPTIONS,
            display: 'avatars',
          },
          { key: 'attention', label: 'Atención', options: ATTENTION_FILTER_OPTIONS },
        ]}
        savedViews={{
          storageKey: 'leads:saved-views:v1',
          filterKeys: LEAD_SAVED_VIEW_FILTER_KEYS,
        }}
      />

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      ) : enrichedLeads.length === 0 ? (
        <Card>
          <CardContent className="px-0 pt-0">
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Aún no hay leads.</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <LeadCreateDialog />
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {boardCapped ? (
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
              <TriangleAlert className="size-4 shrink-0" />
              <span>
                Se muestran los primeros <strong>{LEAD_BOARD_LIMIT}</strong> leads. Usa los filtros
                para acotar los resultados.
              </span>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <LeadsKanban
              leads={enrichedLeads}
              canEdit={canEdit}
              aiEnabled={aiEnabled}
              googleEnabled={googleEnabled}
              members={members}
            />
          </div>
        </div>
      )}
    </div>
  )
}
