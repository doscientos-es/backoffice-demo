import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/finance'
import { getExpenseVendorSuggestions, getFinanceDetails } from '@/lib/finance/queries'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

import { ExpenseListActions } from '../expenses/_components/expense-list-actions'
import { FinanceCategoryChart } from '../finance-category-chart'

type Props = { since: string; until: string; rangeLabel: string }

export async function FinanceDetails({ since, until, rangeLabel }: Props) {
  const user = await requireUser()
  const supabase = await createServerClient()
  const [
    { topCategories, recentExpenses, recentInvoices, memberContributions },
    { data: projectsRaw },
    { data: teamMembersRaw },
    vendorSuggestions,
  ] = await Promise.all([
    getFinanceDetails(since, until),
    supabase
      .from('projects')
      .select('id, name, clients(name)')
      .is('deleted_at', null)
      .order('name'),
    supabase.from('team_members').select('id, name').is('deleted_at', null).order('name'),
    getExpenseVendorSuggestions(),
  ])

  const projects = (projectsRaw ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    clientName: (p.clients as unknown as { name: string } | null)?.name ?? null,
  }))
  const teamMembers = (teamMembersRaw ?? []) as Array<{ id: string; name: string }>
  const canEdit = user.role !== 'viewer'
  const canDelete = user.role === 'owner' || user.role === 'admin'

  const categorySlices = topCategories.map(([cat, total]) => ({
    name: EXPENSE_CATEGORY_LABELS[cat] ?? cat,
    value: total,
  }))
  const memberBars = [...memberContributions]
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ name: c.memberName, value: c.total }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Top categorías · {rangeLabel.toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {categorySlices.length === 0 ? (
              <p className="text-muted-foreground px-6 py-2 text-sm">Sin gastos en este periodo.</p>
            ) : (
              <FinanceCategoryChart data={categorySlices} />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Últimas facturas emitidas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {recentInvoices.length === 0 ? (
              <p className="text-muted-foreground px-6 py-2 text-sm">Sin facturas recientes.</p>
            ) : (
              <ul className="divide-border divide-y">
                {recentInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between px-6 py-2.5 text-sm"
                  >
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                      {inv.full_number ?? '—'}
                      {inv.client_name ? (
                        <span className="text-muted-foreground ml-2">· {inv.client_name}</span>
                      ) : null}
                    </Link>
                    <span className="tabular-nums">{formatEUR(inv.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Últimos gastos</CardTitle>
            <Link
              href="/finance/expenses"
              className="text-muted-foreground text-xs hover:underline"
            >
              Ver todos →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {recentExpenses.length === 0 ? (
            <p className="text-muted-foreground px-6 py-2 text-sm">Sin gastos aún.</p>
          ) : (
            <ul className="divide-border divide-y">
              {recentExpenses.map((e) => (
                <li
                  key={e.id}
                  className="group flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                >
                  <Link href={`/finance/expenses/${e.id}`} className="font-medium hover:underline">
                    {e.vendor}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category} ·{' '}
                      {formatDate(e.expense_date)}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <ExpenseListActions
                        expense={e}
                        projects={projects}
                        teamMembers={teamMembers}
                        vendorSuggestions={vendorSuggestions}
                        canDelete={canDelete}
                      />
                    ) : null}
                    <span className="tabular-nums">{formatEUR(e.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {memberContributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aportaciones de socios · histórico</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-border divide-y">
              {memberBars.map((m) => (
                <li key={m.name} className="flex items-center justify-between px-6 py-2.5 text-sm">
                  <span className="font-medium">{m.name}</span>
                  <span className="tabular-nums">{formatEUR(m.value)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
