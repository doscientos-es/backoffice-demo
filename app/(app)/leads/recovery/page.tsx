import type { Metadata } from 'next'

import { isAIEnabled } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { listActiveMembers } from '@/lib/members/queries'
import { getRecoveryKpis, listLostLeads } from '@/lib/recovery/queries'
import {
  RECOVERY_LIST_PAGE_SIZE,
  RECOVERY_SORT_COLUMNS,
  type RecoveryClosureStatus,
} from '@/lib/recovery/types'
import { parseSortParam } from '@/lib/utils/search-params'

import { RecoveryKpis } from './recovery-kpis'
import { RecoveryList } from './recovery-list'

export const metadata: Metadata = { title: 'Repesca · doscientos' }
export const dynamic = 'force-dynamic'

const STATUS_FILTER_OPTIONS = [
  { value: 'lost', label: 'Perdido' },
  { value: 'not_interested', label: 'No interesa' },
]

/** Common `lost_reason` presets (mirrors close-reason-dialog) for the filter. */
const REASON_FILTER_OPTIONS = [
  'Precio',
  'Timing / Calendario',
  'Eligió competencia',
  'No es buen fit',
  'Sin respuesta',
  'Sin presupuesto',
  'Mal timing',
  'Sin interés real',
  'Duplicado',
].map((r) => ({ value: r, label: r }))

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    reason?: string
    assignee?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const status =
    sp.status === 'lost' || sp.status === 'not_interested'
      ? (sp.status as RecoveryClosureStatus)
      : null
  const reason = REASON_FILTER_OPTIONS.some((o) => o.value === sp.reason)
    ? (sp.reason as string)
    : null
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const { sort, dir } = parseSortParam(sp, RECOVERY_SORT_COLUMNS, 'lost_at', 'desc')

  await requireUser()
  const aiEnabled = isAIEnabled()

  const members = await listActiveMembers()
  const memberIds = new Set(members.map((m) => m.id))
  const assignee = memberIds.has(sp.assignee ?? '') ? (sp.assignee as string) : null

  const [kpis, { leads, count, error }] = await Promise.all([
    getRecoveryKpis(),
    listLostLeads({ q, status, reason, assignee, page, sort, dir }),
  ])

  const ASSIGNEE_FILTER_OPTIONS = members.map((m) => ({ value: m.id, label: m.name }))
  const hasFilters = q.length > 0 || !!status || !!reason || !!assignee

  return (
    <div className="flex flex-col gap-6">
      <RecoveryKpis kpis={kpis} />
      <RecoveryList
        leads={leads}
        aiEnabled={aiEnabled}
        title="Repesca"
        description="Reengancha leads perdidos: prioriza, contacta y reábrelos al pipeline."
        breadcrumbs={[{ label: 'Leads', href: '/leads' }, { label: 'Repesca' }]}
        error={error ?? undefined}
        empty={hasFilters ? 'Sin coincidencias.' : 'No hay leads perdidos para repescar.'}
        searchKey="q"
        searchPlaceholder="Buscar por nombre, empresa o email…"
        filters={[
          { key: 'status', label: 'Cierre', options: STATUS_FILTER_OPTIONS },
          { key: 'reason', label: 'Motivo', options: REASON_FILTER_OPTIONS },
          { key: 'assignee', label: 'Responsable', options: ASSIGNEE_FILTER_OPTIONS },
        ]}
        pagination={{ page, pageSize: RECOVERY_LIST_PAGE_SIZE, total: count }}
        headers={[
          { label: 'Nombre', sortKey: 'name' },
          { label: 'Empresa', sortKey: 'company' },
          'Motivo',
          'Repesca',
          'Señales',
          'Responsable',
          { label: 'Perdido', sortKey: 'lost_at' },
          { label: 'Valor', sortKey: 'estimated_value', align: 'right' },
          { label: 'Acciones', align: 'right' },
        ]}
        align={['left', 'left', 'left', 'left', 'left', 'left', 'left', 'right', 'right']}
        exportFilename="repesca-leads"
      />
    </div>
  )
}
