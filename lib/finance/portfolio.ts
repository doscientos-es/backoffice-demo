import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

import { computeProjectProfitability, type ProjectProfitability } from './helpers'

export type PortfolioRow = ProjectProfitability & {
  id: string
  name: string
  status: string
  clientId: string | null
  clientName: string | null
}

/**
 * Aggregates profitability for every non-deleted project.
 *
 * Executes 5 queries in parallel (projects, clients, work_logs, invoices,
 * expenses + settings) then joins them in JS — same pattern used in the
 * project detail page but lifted to the full portfolio.
 */
export async function getProjectPortfolio(): Promise<PortfolioRow[]> {
  const supabase = await createServerClient()

  const [
    { data: projects },
    { data: workLogs },
    { data: invoices },
    { data: expenses },
    { data: settingsRow },
  ] = await Promise.all([
    notDeleted(
      supabase
        .from('projects')
        .select('id, name, status, client_id, clients(id, name)')
        .order('name'),
    ),
    notDeleted(supabase.from('work_logs').select('project_id, hours')),
    notDeleted(
      supabase
        .from('invoices')
        .select('project_id, total, status')
        .neq('status', 'draft')
        .neq('status', 'cancelled'),
    ),
    notDeleted(
      supabase
        .from('expenses')
        .select('project_id, total')
        .neq('status', 'cancelled')
        .not('project_id', 'is', null),
    ),
    supabase.from('settings').select('internal_hourly_cost').eq('id', 1).maybeSingle(),
  ])

  const hourlyCost = Number(
    (settingsRow as { internal_hourly_cost?: number | string | null } | null)
      ?.internal_hourly_cost ?? 0,
  )

  // Build lookup maps for O(n) aggregation
  const hoursMap = new Map<string, number>()
  for (const wl of workLogs ?? []) {
    const pid = wl.project_id as string
    hoursMap.set(pid, (hoursMap.get(pid) ?? 0) + Number(wl.hours ?? 0))
  }

  const revenueMap = new Map<string, number>()
  for (const inv of invoices ?? []) {
    const pid = inv.project_id as string | null
    if (!pid) continue
    revenueMap.set(pid, (revenueMap.get(pid) ?? 0) + Number(inv.total ?? 0))
  }

  const expensesMap = new Map<string, number>()
  for (const exp of expenses ?? []) {
    const pid = exp.project_id as string | null
    if (!pid) continue
    expensesMap.set(pid, (expensesMap.get(pid) ?? 0) + Number(exp.total ?? 0))
  }

  return (projects ?? []).map((p) => {
    const pid = p.id as string
    const rawClient = p.clients as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
    const client = Array.isArray(rawClient) ? (rawClient[0] ?? null) : rawClient

    const profitability = computeProjectProfitability({
      revenue: revenueMap.get(pid) ?? 0,
      hours: hoursMap.get(pid) ?? 0,
      hourlyCost,
      expenses: expensesMap.get(pid) ?? 0,
    })

    return {
      id: pid,
      name: p.name as string,
      status: (p.status as string | null) ?? 'active',
      clientId: (p.client_id as string | null) ?? null,
      clientName: client?.name ?? null,
      ...profitability,
    }
  })
}
