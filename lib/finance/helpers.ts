/**
 * Pure helpers for the finance module: aggregation and totals.
 *
 * Kept side-effect free so they can be unit tested without a DB.
 */

export const EXPENSE_CATEGORIES = [
  'hosting',
  'domain',
  'service',
  'software',
  'hardware',
  'office',
  'marketing',
  'meta_ads',
  'professional',
  'travel',
  'taxes',
  'salary',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_STATUSES = ['pending', 'paid', 'cancelled'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

export const EXPENSE_RECURRENCES = ['none', 'monthly', 'quarterly', 'yearly'] as const
export type ExpenseRecurrence = (typeof EXPENSE_RECURRENCES)[number]

export const EXPENSE_PAYMENT_SOURCES = ['company', 'member'] as const
export type ExpensePaymentSource = (typeof EXPENSE_PAYMENT_SOURCES)[number]

export const EXPENSE_PAYMENT_SOURCE_LABELS: Record<ExpensePaymentSource, string> = {
  company: 'Cuenta de empresa',
  member: 'Socio',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  hosting: 'Hosting',
  domain: 'Dominios',
  service: 'Servicios API',
  software: 'Software / SaaS',
  hardware: 'Hardware',
  office: 'Oficina',
  marketing: 'Marketing',
  meta_ads: 'Meta Ads',
  professional: 'Profesionales',
  travel: 'Desplazamientos',
  taxes: 'Impuestos',
  salary: 'Salarios',
  other: 'Otros',
}

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  cancelled: 'Cancelado',
}

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  none: 'Único',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

/**
 * Canonical defaults for a brand-new expense — the single source of truth
 * shared by the form UI (initial field values) and the Zod schema (server-side
 * fallback when a field is absent from FormData). Keeps the two from drifting.
 *
 * `expense_date` is intentionally omitted: it defaults to "today", computed at
 * render time rather than baked into a constant.
 */
export const EXPENSE_FORM_DEFAULTS = {
  category: 'service',
  status: 'paid',
  recurrence: 'none',
  currency: 'EUR',
  tax_rate: 21,
  subtotal: 0,
  payment_source: 'company',
} as const satisfies {
  category: ExpenseCategory
  status: ExpenseStatus
  recurrence: ExpenseRecurrence
  currency: string
  tax_rate: number
  subtotal: number
  payment_source: ExpensePaymentSource
}

/**
 * Cadence at which a proposal line item is billed. Re-exports the expense
 * recurrence vocabulary so proposals and expenses speak the same language.
 */
export const BILLING_CYCLES = EXPENSE_RECURRENCES
export type BillingCycle = ExpenseRecurrence
export const BILLING_CYCLE_LABELS = EXPENSE_RECURRENCE_LABELS

/**
 * Round a monetary value to 2 decimals. Single source of truth used by every
 * totals computation in the app — invoices, proposals, expenses.
 */
export function roundCurrency(x: number): number {
  return Math.round(x * 100) / 100
}

/** Shape of an editable line item (proposal / invoice). */
export type LineItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  /**
   * Billing cadence. Only meaningful for proposals — invoices ignore it and
   * always behave as one-time. Defaults to `none` so legacy data keeps its
   * current behavior.
   */
  billing_cycle?: BillingCycle
}

/** Sensible default line used when adding rows in editors. */
export const EMPTY_LINE_ITEM: Omit<LineItem, 'id'> = {
  description: '',
  quantity: 1,
  unit_price: 0,
  vat_rate: 21,
  billing_cycle: 'none',
}

/** Per-line subtotal (quantity × unit price), rounded to 2 decimals. */
export function computeLineSubtotal(item: Pick<LineItem, 'quantity' | 'unit_price'>): number {
  const q = Number(item.quantity) || 0
  const up = Number(item.unit_price) || 0
  return roundCurrency(q * up)
}

/**
 * Aggregate subtotal, tax_amount and total from a list of line items.
 * Pure and side-effect free; safe for client and server use.
 *
 * Treats every line as one-time. Callers that need recurring buckets must
 * use {@link computeProposalTotals} instead.
 */
export function computeLineTotals(
  items: ReadonlyArray<Pick<LineItem, 'quantity' | 'unit_price' | 'vat_rate'>>,
): { subtotal: number; taxAmount: number; total: number } {
  let subtotal = 0
  let taxAmount = 0
  for (const it of items) {
    const q = Number(it.quantity) || 0
    const up = Number(it.unit_price) || 0
    const vat = Number(it.vat_rate) || 0
    const line = q * up
    subtotal += line
    taxAmount += line * (vat / 100)
  }
  const s = roundCurrency(subtotal)
  const t = roundCurrency(taxAmount)
  return { subtotal: s, taxAmount: t, total: roundCurrency(s + t) }
}

/** Totals bucketed by cadence. `total` includes VAT. */
export type ProposalBucket = { subtotal: number; taxAmount: number; total: number }

export type ProposalTotals = {
  /** Items with billing_cycle === 'none'. This is what gets invoiced first. */
  oneTime: ProposalBucket
  monthly: ProposalBucket
  quarterly: ProposalBucket
  yearly: ProposalBucket
  /** Sum across all cadences — useful as a single headline figure. */
  grand: ProposalBucket
}

const emptyBucket = (): ProposalBucket => ({ subtotal: 0, taxAmount: 0, total: 0 })

/**
 * Bucket proposal line items by billing cadence. The recurring buckets are
 * expressed per-period (e.g. `monthly.total` is the monthly charge), not
 * annualised.
 */
export function computeProposalTotals(
  items: ReadonlyArray<
    Pick<LineItem, 'quantity' | 'unit_price' | 'vat_rate'> & { billing_cycle?: BillingCycle | null }
  >,
): ProposalTotals {
  const buckets: Record<BillingCycle, ProposalBucket> = {
    none: emptyBucket(),
    monthly: emptyBucket(),
    quarterly: emptyBucket(),
    yearly: emptyBucket(),
  }

  for (const it of items) {
    const q = Number(it.quantity) || 0
    const up = Number(it.unit_price) || 0
    const vat = Number(it.vat_rate) || 0
    const base = q * up
    const cycle: BillingCycle =
      it.billing_cycle && (BILLING_CYCLES as readonly string[]).includes(it.billing_cycle)
        ? (it.billing_cycle as BillingCycle)
        : 'none'
    const bucket = buckets[cycle]
    bucket.subtotal += base
    bucket.taxAmount += base * (vat / 100)
  }

  const finalize = (b: ProposalBucket): ProposalBucket => {
    const s = roundCurrency(b.subtotal)
    const t = roundCurrency(b.taxAmount)
    return { subtotal: s, taxAmount: t, total: roundCurrency(s + t) }
  }

  const oneTime = finalize(buckets.none)
  const monthly = finalize(buckets.monthly)
  const quarterly = finalize(buckets.quarterly)
  const yearly = finalize(buckets.yearly)
  const grand: ProposalBucket = {
    subtotal: roundCurrency(
      oneTime.subtotal + monthly.subtotal + quarterly.subtotal + yearly.subtotal,
    ),
    taxAmount: roundCurrency(
      oneTime.taxAmount + monthly.taxAmount + quarterly.taxAmount + yearly.taxAmount,
    ),
    total: roundCurrency(oneTime.total + monthly.total + quarterly.total + yearly.total),
  }

  return { oneTime, monthly, quarterly, yearly, grand }
}

/** Row in a VAT breakdown table (one entry per distinct rate). */
export type VatBreakdownRow = { rate: number; base: number; tax: number }

/**
 * Group line items by VAT rate and return the desglose por tipo expected by
 * Spanish invoices. Tolerant of `null` / `string` inputs coming from Supabase.
 */
export function buildVatBreakdown(
  items: ReadonlyArray<{
    vat_rate: number | string | null | undefined
    subtotal: number | string | null | undefined
  }>,
): VatBreakdownRow[] {
  const grouped = items.reduce<Record<string, VatBreakdownRow>>((acc, it) => {
    const rate = Number(it.vat_rate) || 0
    const base = Number(it.subtotal) || 0
    const tax = base * (rate / 100)
    const key = rate.toFixed(2)
    acc[key] ??= { rate, base: 0, tax: 0 }
    acc[key].base += base
    acc[key].tax += tax
    return acc
  }, {})
  return Object.values(grouped).sort((a, b) => a.rate - b.rate)
}

/** Compute tax_amount and total from subtotal and tax_rate (%). */
export function computeExpenseTotals(
  subtotal: number,
  taxRate: number,
): {
  subtotal: number
  taxAmount: number
  total: number
} {
  const safeSubtotal = Number.isFinite(subtotal) ? subtotal : 0
  const safeRate = Number.isFinite(taxRate) ? taxRate : 0
  const safeBase = roundCurrency(safeSubtotal)
  const taxAmount = roundCurrency((safeSubtotal * safeRate) / 100)
  return {
    subtotal: safeBase,
    taxAmount,
    total: roundCurrency(safeBase + taxAmount),
  }
}

export type MonthlyPoint = {
  /** Short ES month label ("ene", "feb"...). */
  month: string
  revenue: number
  expense: number
  /** revenue - expense */
  net: number
}

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

/**
 * Build a 6-month rolling series (oldest -> current month) combining revenue
 * (invoice totals by issue_date) and expenses (by expense_date).
 *
 * The reference date is `now`, defaulting to today; useful for tests.
 */
export function buildMonthlySeries(
  revenueRows: ReadonlyArray<{ date: string | Date; total: number }>,
  expenseRows: ReadonlyArray<{ date: string | Date; total: number }>,
  now: Date = new Date(),
): MonthlyPoint[] {
  const months = new Map<string, MonthlyPoint>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    months.set(key, {
      month: MONTHS_ES[d.getMonth()] ?? '',
      revenue: 0,
      expense: 0,
      net: 0,
    })
  }

  const addTo = (
    source: ReadonlyArray<{ date: string | Date; total: number }>,
    key: 'revenue' | 'expense',
  ) => {
    for (const row of source) {
      const d = typeof row.date === 'string' ? new Date(row.date) : row.date
      const mapKey = `${d.getFullYear()}-${d.getMonth()}`
      const point = months.get(mapKey)
      if (!point) continue
      point[key] += Number(row.total ?? 0)
    }
  }

  addTo(revenueRows, 'revenue')
  addTo(expenseRows, 'expense')

  return Array.from(months.values()).map((p) => ({
    month: p.month,
    revenue: roundCurrency(p.revenue),
    expense: roundCurrency(p.expense),
    net: roundCurrency(p.revenue - p.expense),
  }))
}

/** Profit margin as a 0..100 percentage, or null when revenue is 0. */
export function profitMargin(revenue: number, expense: number): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null
  const margin = ((revenue - expense) / revenue) * 100
  return Math.round(margin * 10) / 10
}

/** Profitability breakdown for a single project (or client aggregate). */
export type ProjectProfitability = {
  /** Facturado computable (sin borradores ni anuladas). */
  revenue: number
  /** Σ horas registradas (work_logs). */
  hours: number
  /** Coste interno por hora aplicado. */
  hourlyCost: number
  /** hours × hourlyCost. */
  laborCost: number
  /** Σ gastos atribuidos al proyecto. */
  expenses: number
  /** laborCost + expenses. */
  totalCost: number
  /** revenue − totalCost (€ absolutos). */
  margin: number
  /** Margen como % 0..100, o null si no hay ingresos. */
  marginPct: number | null
  /** €/h efectivo (revenue ÷ hours), o null sin horas. */
  effectiveRate: number | null
}

/**
 * Computes a project's profitability from already-aggregated inputs. Pure and
 * side-effect free so it can be reused server-side and unit-tested. Hours are
 * "valued" with the company-wide internal hourly cost (`settings.internal_hourly_cost`):
 * when that cost is 0 the labor cost is 0 and the margin collapses to
 * `revenue − expenses`.
 */
export function computeProjectProfitability(input: {
  revenue: number
  hours: number
  hourlyCost: number
  expenses: number
}): ProjectProfitability {
  const revenue = roundCurrency(Number(input.revenue) || 0)
  const hours = Number(input.hours) || 0
  const hourlyCost = Number(input.hourlyCost) || 0
  const expenses = roundCurrency(Number(input.expenses) || 0)
  const laborCost = roundCurrency(hours * hourlyCost)
  const totalCost = roundCurrency(laborCost + expenses)
  return {
    revenue,
    hours,
    hourlyCost,
    laborCost,
    expenses,
    totalCost,
    margin: roundCurrency(revenue - totalCost),
    marginPct: profitMargin(revenue, totalCost),
    effectiveRate: hours > 0 ? roundCurrency(revenue / hours) : null,
  }
}
