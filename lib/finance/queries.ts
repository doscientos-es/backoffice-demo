import { cache } from 'react'

import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

import {
  buildMonthlySeries,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  type ExpenseCategory,
  type ExpensePaymentSource,
  type ExpenseRecurrence,
  type ExpenseStatus,
  type MonthlyPoint,
  profitMargin,
} from './helpers'
import {
  EXPENSE_LIST_PAGE_SIZE,
  type ExpenseDetailResult,
  type ExpenseListParams,
  type ExpenseListResult,
  type FinanceDetails,
  type FinanceKpis,
  type MemberContribution,
  type VendorSuggestion,
} from './types'

const log = scopedLogger('finance.queries')

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`)
}

/**
 * Expense rows (total + category) for a given date range, shared by the KPIs
 * and the details section. Wrapped in `cache()` so both server components with
 * the same (since, until) reuse a single DB round-trip per request.
 */
const getExpensesInRange = cache(
  async (
    since: string,
    until: string,
  ): Promise<Array<{ total: number; category: ExpenseCategory }>> => {
    const supabase = await createServerClient()
    const { data } = await notDeleted(
      supabase
        .from('expenses')
        .select('total, category')
        .gte('expense_date', since)
        .lte('expense_date', until)
        .neq('status', 'cancelled'),
    )
    return (data ?? []).map((r) => ({
      total: Number(r.total ?? 0),
      category: r.category as ExpenseCategory,
    }))
  },
)

/** Headline KPIs for the selected date window: revenue, expenses, net and margin. */
export async function getFinanceKpis(since: string, until: string): Promise<FinanceKpis> {
  const supabase = await createServerClient()

  const [{ data: revenue }, expenses, { data: collected }, { data: outstandingInvoices }] =
    await Promise.all([
      notDeleted(
        supabase
          .from('invoices')
          .select('total')
          .gte('issue_date', since)
          .lte('issue_date', until)
          .in('status', ['issued', 'paid', 'overdue']),
      ),
      getExpensesInRange(since, until),
      // Real cash collected through the gateway within the range (by confirmation date).
      supabase
        .from('invoice_payments')
        .select('amount')
        .eq('status', 'confirmed')
        .gte('confirmed_at', since)
        .lte('confirmed_at', `${until}T23:59:59.999Z`),
      // Open invoices (issued/overdue) to compute outstanding receivables.
      notDeleted(supabase.from('invoices').select('id, total').in('status', ['issued', 'overdue'])),
    ])

  const revenueMonth = (revenue ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)
  const expenseMonth = expenses.reduce((a, r) => a + r.total, 0)
  const cashCollected = (collected ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0)

  const openIds = (outstandingInvoices ?? []).map((r) => r.id as string)
  const openTotal = (outstandingInvoices ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)

  let paidOnOpen = 0
  if (openIds.length > 0) {
    const { data: openPayments } = await supabase
      .from('invoice_payments')
      .select('amount')
      .eq('status', 'confirmed')
      .in('invoice_id', openIds)
    paidOnOpen = (openPayments ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0)
  }
  const pendingCollection = Math.max(0, openTotal - paidOnOpen)

  return {
    revenueMonth,
    expenseMonth,
    netMonth: revenueMonth - expenseMonth,
    margin: profitMargin(revenueMonth, expenseMonth),
    cashCollected,
    pendingCollection,
  }
}

/** Rolling 6-month revenue vs expense series for the overview chart. */
export async function getFinanceMonthlySeries(): Promise<MonthlyPoint[]> {
  const supabase = await createServerClient()
  const today = new Date()
  const sixMonthsAgoISO = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10)

  const [{ data: revenueRows }, { data: expenseRows }] = await Promise.all([
    notDeleted(
      supabase
        .from('invoices')
        .select('issue_date, total')
        .gte('issue_date', sixMonthsAgoISO)
        .in('status', ['issued', 'paid', 'overdue']),
    ),
    notDeleted(
      supabase
        .from('expenses')
        .select('expense_date, total')
        .gte('expense_date', sixMonthsAgoISO)
        .neq('status', 'cancelled'),
    ),
  ])

  return buildMonthlySeries(
    (revenueRows ?? []).map((r) => ({
      date: r.issue_date as string,
      total: Number(r.total ?? 0),
    })),
    (expenseRows ?? []).map((r) => ({
      date: r.expense_date as string,
      total: Number(r.total ?? 0),
    })),
    today,
  )
}

/** Supporting lists: top categories, recent movements and member contributions. */
/** Supporting lists: top categories for the range, recent movements, and all-time member contributions. */
export async function getFinanceDetails(since: string, until: string): Promise<FinanceDetails> {
  const supabase = await createServerClient()

  const [
    rangeExpenses,
    { data: recentExpenses },
    { data: recentInvoices },
    { data: memberExpenseRows },
  ] = await Promise.all([
    getExpensesInRange(since, until),
    notDeleted(
      supabase
        .from('expenses')
        .select(
          'id, version, vendor, category, status, total, expense_date, recurrence, description, due_date, paid_at, currency, subtotal, tax_rate, vendor_nif, invoice_reference, project_id, notes, payment_source, paid_by_member_id',
        )
        .order('expense_date', { ascending: false })
        .limit(5),
    ),
    notDeleted(
      supabase
        .from('invoices')
        .select('id, full_number, total, issue_date, clients(name)')
        .neq('status', 'draft')
        .order('issue_date', { ascending: false })
        .limit(5),
    ),
    // Member contributions: expenses personally paid by a partner
    // Typed explicitly to avoid TS2589 with deep Supabase generic chains
    Promise.resolve(
      supabase
        .from('expenses')
        .select('paid_by_member_id, total')
        .is('deleted_at', null)
        .eq('payment_source', 'member' as string)
        .neq('status', 'cancelled')
        .not('paid_by_member_id', 'is', null),
    ).then(async (q) => q) as unknown as Promise<{
      data: Array<{ paid_by_member_id: string | null; total: number | null }> | null
      error: unknown
    }>,
  ])

  const byCategory = new Map<ExpenseCategory, number>()
  for (const row of rangeExpenses) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.total)
  }
  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Aggregate member contributions; resolve names with a second query only if needed
  const memberRows =
    (memberExpenseRows as Array<{
      paid_by_member_id: string | null
      total: number | null
    }> | null) ?? []
  const byMember = new Map<string, number>()
  for (const row of memberRows) {
    if (!row.paid_by_member_id) continue
    byMember.set(
      row.paid_by_member_id,
      (byMember.get(row.paid_by_member_id) ?? 0) + Number(row.total ?? 0),
    )
  }

  let memberContributions: MemberContribution[] = []
  if (byMember.size > 0) {
    const memberIds = Array.from(byMember.keys())
    const { data: membersData } = await supabase
      .from('team_members')
      .select('id, name')
      .in('id', memberIds)
    const nameMap = new Map((membersData ?? []).map((m) => [m.id as string, m.name as string]))
    memberContributions = memberIds.map((memberId) => ({
      memberId,
      memberName: nameMap.get(memberId) ?? memberId,
      total: byMember.get(memberId) ?? 0,
    }))
  }

  return {
    topCategories,
    memberContributions,
    recentExpenses: (recentExpenses ?? []).map((e) => ({
      id: e.id as string,
      version: Number(e.version),
      vendor: e.vendor as string,
      category: e.category as ExpenseCategory,
      status: e.status as ExpenseStatus,
      total: Number(e.total ?? 0),
      expense_date: e.expense_date as string,
      recurrence: e.recurrence as ExpenseRecurrence,
      description: (e.description as string | null) ?? null,
      due_date: (e.due_date as string | null) ?? null,
      paid_at: (e.paid_at as string | null) ?? null,
      currency: (e.currency as string | null) ?? 'EUR',
      subtotal: Number(e.subtotal ?? 0),
      tax_rate: Number(e.tax_rate ?? 0),
      vendor_nif: (e.vendor_nif as string | null) ?? null,
      invoice_reference: (e.invoice_reference as string | null) ?? null,
      project_id: (e.project_id as string | null) ?? null,
      notes: (e.notes as string | null) ?? null,
      payment_source: ((e.payment_source as string | null) ?? 'company') as ExpensePaymentSource,
      paid_by_member_id: (e.paid_by_member_id as string | null) ?? null,
    })),
    recentInvoices: (recentInvoices ?? []).map((inv) => ({
      id: inv.id,
      full_number: inv.full_number,
      total: Number(inv.total ?? 0),
      issue_date: inv.issue_date,
      client_name:
        (inv.clients as { name: string } | { name: string }[] | null) != null
          ? ((Array.isArray(inv.clients)
              ? inv.clients[0]?.name
              : (inv.clients as { name: string })?.name) ?? null)
          : null,
    })),
  }
}

export function parseExpenseListSearchParams(sp: {
  year?: string
  category?: string
  status?: string
  q?: string
  page?: string
}): { params: ExpenseListParams; rawYear: string | null } {
  const rawYear = sp.year ?? null
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(sp.category ?? '')
    ? (sp.category as ExpenseCategory)
    : null
  const status = (EXPENSE_STATUSES as readonly string[]).includes(sp.status ?? '')
    ? (sp.status as ExpenseStatus)
    : null
  const q = (sp.q ?? '').trim()
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  return { params: { year: rawYear, category, status, q, page }, rawYear }
}

export async function getExpensesPage(params: ExpenseListParams): Promise<ExpenseListResult> {
  const supabase = await createServerClient()

  const { data: yearRows, error: yearErr } = await notDeleted(
    supabase.from('expenses').select('expense_date'),
  )
    .order('expense_date', { ascending: false })
    .limit(500)

  if (yearErr) log.error({ err: yearErr.message }, 'expenses_years_failed')

  const years = Array.from(
    new Set(
      (yearRows ?? [])
        .map((r) => (r.expense_date as string | null)?.slice(0, 4))
        .filter((y): y is string => Boolean(y)),
    ),
  )
  if (years.length === 0) years.push(String(new Date().getFullYear()))

  const year = params.year && years.includes(params.year) ? params.year : null
  const { category, status, q, page } = params
  const from = (page - 1) * EXPENSE_LIST_PAGE_SIZE
  const to = from + EXPENSE_LIST_PAGE_SIZE - 1

  let pageQuery = notDeleted(
    supabase
      .from('expenses')
      .select(
        'id, version, vendor, category, status, total, expense_date, recurrence, description, due_date, paid_at, currency, subtotal, tax_rate, vendor_nif, invoice_reference, project_id, notes, payment_source, paid_by_member_id',
        { count: 'exact' },
      ),
  )
  let totalsQuery = notDeleted(supabase.from('expenses').select('total'))

  if (year) {
    pageQuery = pageQuery.gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`)
    totalsQuery = totalsQuery
      .gte('expense_date', `${year}-01-01`)
      .lte('expense_date', `${year}-12-31`)
  }
  if (category) {
    pageQuery = pageQuery.eq('category', category)
    totalsQuery = totalsQuery.eq('category', category)
  }
  if (status) {
    pageQuery = pageQuery.eq('status', status)
    totalsQuery = totalsQuery.eq('status', status)
  }
  if (q.length > 0) {
    const pattern = `%${escapeIlike(q)}%`
    pageQuery = pageQuery.ilike('vendor', pattern)
    totalsQuery = totalsQuery.ilike('vendor', pattern)
  }

  const [{ data, error, count }, { data: totalsRows, error: totalsErr }] = await Promise.all([
    pageQuery.order('expense_date', { ascending: false }).range(from, to),
    totalsQuery,
  ])

  if (error) log.error({ err: error.message }, 'expenses_page_failed')
  if (totalsErr) log.error({ err: totalsErr.message }, 'expenses_totals_failed')

  const total = (totalsRows ?? []).reduce(
    (a, r) => a + Number((r as { total: number | null }).total ?? 0),
    0,
  )

  return {
    expenses: (data ?? []).map((e) => ({
      id: e.id as string,
      version: Number(e.version),
      vendor: e.vendor as string,
      category: e.category as ExpenseCategory,
      status: e.status as ExpenseStatus,
      total: Number(e.total ?? 0),
      expense_date: e.expense_date as string,
      recurrence: e.recurrence as ExpenseRecurrence,
      description: (e.description as string | null) ?? null,
      due_date: (e.due_date as string | null) ?? null,
      paid_at: (e.paid_at as string | null) ?? null,
      currency: (e.currency as string | null) ?? 'EUR',
      subtotal: Number(e.subtotal ?? 0),
      tax_rate: Number(e.tax_rate ?? 0),
      vendor_nif: (e.vendor_nif as string | null) ?? null,
      invoice_reference: (e.invoice_reference as string | null) ?? null,
      project_id: (e.project_id as string | null) ?? null,
      notes: (e.notes as string | null) ?? null,
      payment_source: ((e.payment_source as string | null) ?? 'company') as ExpensePaymentSource,
      paid_by_member_id: (e.paid_by_member_id as string | null) ?? null,
    })),
    count: count ?? 0,
    total,
    years,
    error: error?.message ?? null,
  }
}

/**
 * Distinct previously used vendors with their most recent NIF, category and
 * payment source. Powers the vendor/NIF autocomplete in the expense form:
 * picking a known vendor pre-fills its fiscal data. Deduped case-insensitively
 * keeping the most recent occurrence.
 */
export async function getExpenseVendorSuggestions(): Promise<VendorSuggestion[]> {
  const supabase = await createServerClient()

  const { data, error } = await notDeleted(
    supabase.from('expenses').select('vendor, vendor_nif, category, payment_source, expense_date'),
  )
    .order('expense_date', { ascending: false })
    .limit(500)

  if (error) {
    log.error({ err: error.message }, 'expense_vendor_suggestions_failed')
    return []
  }

  const seen = new Set<string>()
  const suggestions: VendorSuggestion[] = []
  for (const row of data ?? []) {
    const vendor = (row.vendor as string | null)?.trim()
    if (!vendor) continue
    const key = vendor.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    suggestions.push({
      vendor,
      vendor_nif: (row.vendor_nif as string | null) ?? null,
      category: row.category as ExpenseCategory,
      payment_source: ((row.payment_source as string | null) ?? 'company') as ExpensePaymentSource,
    })
  }

  return suggestions.sort((a, b) => a.vendor.localeCompare(b.vendor, 'es'))
}

export async function getExpenseDetail(id: string): Promise<ExpenseDetailResult | null> {
  const supabase = await createServerClient()

  const { data: expense, error } = await notDeleted(
    supabase
      .from('expenses')
      // `expenses` has two FKs to `team_members` (created_by + paid_by_member_id),
      // so the embed must disambiguate or PostgREST errors out (→ null → 404).
      .select('*, projects(id, name, clients(id, name)), team_members!paid_by_member_id(id, name)')
      .eq('id', id),
  ).maybeSingle()

  if (error) log.error({ id, err: error.message }, 'expense_detail_failed')
  if (!expense) return null

  const rawProject = (
    expense as unknown as {
      projects: {
        id: string
        name: string
        clients: { id: string; name: string } | { id: string; name: string }[] | null
      } | null
    }
  ).projects
  const projectClient = rawProject
    ? Array.isArray(rawProject.clients)
      ? (rawProject.clients[0] ?? null)
      : rawProject.clients
    : null

  const { data: projectsRaw, error: projectsErr } = await notDeleted(
    supabase.from('projects').select('id, name, clients(name)'),
  ).order('name')

  if (projectsErr) log.error({ err: projectsErr.message }, 'expense_project_options_failed')

  const projectOptions = (
    (projectsRaw ?? []) as unknown as Array<{
      id: string
      name: string
      clients: { name: string } | { name: string }[] | null
    }>
  ).map((p) => {
    const client = Array.isArray(p.clients) ? (p.clients[0] ?? null) : p.clients
    return { id: p.id, name: p.name, clientName: client?.name ?? null }
  })

  return {
    expense: {
      id: expense.id as string,
      version: Number(expense.version),
      vendor: expense.vendor as string,
      description: (expense.description as string | null) ?? null,
      category: expense.category as ExpenseCategory,
      status: expense.status as ExpenseStatus,
      recurrence: expense.recurrence as ExpenseRecurrence,
      expense_date: expense.expense_date as string,
      due_date: (expense.due_date as string | null) ?? null,
      paid_at: (expense.paid_at as string | null) ?? null,
      currency: expense.currency as string,
      subtotal: Number(expense.subtotal ?? 0),
      tax_rate: Number(expense.tax_rate ?? 0),
      tax_amount: Number(expense.tax_amount ?? 0),
      total: Number(expense.total ?? 0),
      vendor_nif: (expense.vendor_nif as string | null) ?? null,
      invoice_reference: (expense.invoice_reference as string | null) ?? null,
      project_id: (expense.project_id as string | null) ?? null,
      notes: (expense.notes as string | null) ?? null,
      payment_source: ((expense.payment_source as string | null) ??
        'company') as ExpensePaymentSource,
      paid_by_member_id: (expense.paid_by_member_id as string | null) ?? null,
      paid_by_member_name: (() => {
        const raw = expense.team_members as
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null
        return (Array.isArray(raw) ? raw[0]?.name : raw?.name) ?? null
      })(),
      project: rawProject
        ? { id: rawProject.id, name: rawProject.name, clientName: projectClient?.name ?? null }
        : null,
    },
    projectOptions,
  }
}
