import { Building2 } from 'lucide-react'
import Link from 'next/link'

import { ListPage } from '@/components/layout/list-page'
import { Button } from '@/components/ui/button'
import { MemberLabel } from '@/components/ui/member-avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { requirePageRole } from '@/lib/auth'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUSES,
} from '@/lib/finance'
import {
  getExpensesPage,
  getExpenseVendorSuggestions,
  parseExpenseListSearchParams,
} from '@/lib/finance/queries'
import { EXPENSE_LIST_PAGE_SIZE } from '@/lib/finance/types'
import { EXPENSE_STATUS } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

import { ExpenseListActions } from './_components/expense-list-actions'

export const metadata = { title: 'Gastos · doscientos' }
export const dynamic = 'force-dynamic'

const CATEGORY_FILTER_OPTIONS = EXPENSE_CATEGORIES.map((c) => ({
  value: c,
  label: EXPENSE_CATEGORY_LABELS[c],
}))

const STATUS_FILTER_OPTIONS = EXPENSE_STATUSES.map((s) => ({
  value: s,
  label: EXPENSE_STATUS_LABELS[s],
}))

type SearchParams = Promise<{
  year?: string
  category?: string
  status?: string
  q?: string
  page?: string
}>

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const [sp, user] = await Promise.all([searchParams, requirePageRole(['owner', 'admin'])])
  const { params } = parseExpenseListSearchParams(sp)

  const supabase = await createServerClient()
  const [
    { expenses, count, total, years, error },
    { data: projectsRaw },
    { data: teamMembersRaw },
    vendorSuggestions,
  ] = await Promise.all([
    getExpensesPage(params),
    supabase
      .from('projects')
      .select('id, name, clients(name)')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('team_members')
      .select('id, name, avatar_url, github_handle')
      .is('deleted_at', null)
      .order('name'),
    getExpenseVendorSuggestions(),
  ])

  const projects = (projectsRaw ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    clientName: (p.clients as unknown as { name: string } | null)?.name ?? null,
  }))
  const teamMembers = (teamMembersRaw ?? []) as Array<{
    id: string
    name: string
    avatar_url: string | null
    github_handle: string | null
  }>
  const memberMap = new Map(teamMembers.map((m) => [m.id, m]))

  const canEdit = user.role !== 'viewer'
  const canDelete = user.role === 'owner' || user.role === 'admin'
  const { category, status, q, page } = params
  const year = params.year && years.includes(params.year) ? params.year : null
  const totalLabel = year ? `Total ${year}` : 'Total filtrado'

  return (
    <ListPage
      title="Gastos"
      description={`${totalLabel}: ${formatEUR(total)}`}
      breadcrumbs={[{ label: 'Finanzas', href: '/finance' }, { label: 'Gastos' }]}
      actions={
        <Button asChild size="sm">
          <Link href="/finance/expenses/new">Nuevo gasto</Link>
        </Button>
      }
      empty={year || category || status || q ? 'Sin coincidencias.' : 'Aún no hay gastos.'}
      emptyAction={
        <Button asChild size="sm">
          <Link href="/finance/expenses/new">Registrar el primero</Link>
        </Button>
      }
      error={error ?? undefined}
      searchKey="q"
      searchPlaceholder="Buscar por proveedor…"
      filters={[
        { key: 'year', label: 'Año', options: years.map((y) => ({ value: y, label: y })) },
        { key: 'category', label: 'Categoría', options: CATEGORY_FILTER_OPTIONS },
        { key: 'status', label: 'Estado', options: STATUS_FILTER_OPTIONS },
      ]}
      pagination={{ page, pageSize: EXPENSE_LIST_PAGE_SIZE, total: count }}
      headers={['Proveedor', 'Fecha', 'Categoría', 'Estado', 'Pagado por', 'Total', '']}
      align={['left', 'left', 'left', 'left', 'left', 'right', 'right']}
      rows={expenses.map((e) => {
        const payer =
          e.payment_source === 'member' && e.paid_by_member_id
            ? (memberMap.get(e.paid_by_member_id) ?? null)
            : null

        return {
          id: e.id,
          href: `/finance/expenses/${e.id}`,
          cells: [
            e.vendor,
            formatDate(e.expense_date),
            EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
            <StatusBadge key={`${e.id}-status`} meta={EXPENSE_STATUS} value={e.status} />,
            payer ? (
              <MemberLabel key={`${e.id}-payer`} member={payer} size="sm" />
            ) : (
              <span
                key={`${e.id}-payer`}
                className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
              >
                <Building2 className="size-3.5 shrink-0" />
                Empresa
              </span>
            ),
            formatEUR(e.total),
            canEdit ? (
              <ExpenseListActions
                key={`${e.id}-actions`}
                expense={e}
                projects={projects}
                teamMembers={teamMembers}
                vendorSuggestions={vendorSuggestions}
                canDelete={canDelete}
              />
            ) : null,
          ],
        }
      })}
    />
  )
}
