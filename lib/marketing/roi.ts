import type { StatTone } from '@/components/layout/stat-card'

/**
 * Marketing return-on-investment for the Meta Ads channel.
 *
 * - `cac`  (Coste de Adquisición de Cliente) = spend / acquiredCustomers
 * - `roas` (Return On Ad Spend)              = revenue / spend
 *
 * `revenue` is the *lifetime* invoiced amount of the acquired customers, not a
 * windowed figure: there is an inherent lag between acquiring a lead and the
 * invoices it eventually generates, so pinning revenue to the spend window
 * would systematically understate ROAS. `spend`/`leads`/`acquiredCustomers`
 * are scoped to the selected period.
 */
export type MarketingRoi = {
  spend: number
  leads: number
  /** All leads created in the selected period, regardless of channel. */
  totalLeads: number
  /** Leads closed as won in the selected period, regardless of channel. */
  closedLeads: number
  /** Sum of estimated_value for won leads in the selected period. */
  closedPipelineValue: number
  acquiredCustomers: number
  revenue: number
  /** spend / acquiredCustomers, or null when no customers were acquired. */
  cac: number | null
  /** revenue / spend, or null when there was no spend. */
  roas: number | null
  /** acquiredCustomers / leads (0..1), or null when there were no leads. */
  conversionRate: number | null
  /** closedLeads / totalLeads, or null when there were no leads. */
  closedLeadRate: number | null
  /** closedPipelineValue / closedLeads, or null when there were no won leads. */
  averageClosedValue: number | null
  currency: string
}

export type MarketingRoiInput = {
  spend: number
  leads: number
  totalLeads?: number
  closedLeads?: number
  closedPipelineValue?: number
  acquiredCustomers: number
  revenue: number
  currency?: string
}

function num(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeMarketingRoi(input: MarketingRoiInput): MarketingRoi {
  const spend = Math.max(0, num(input.spend))
  const leads = Math.max(0, Math.round(num(input.leads)))
  const totalLeads = Math.max(0, Math.round(num(input.totalLeads)))
  const closedLeads = Math.max(0, Math.round(num(input.closedLeads)))
  const closedPipelineValue = Math.max(0, num(input.closedPipelineValue))
  const acquiredCustomers = Math.max(0, Math.round(num(input.acquiredCustomers)))
  const revenue = Math.max(0, num(input.revenue))

  return {
    spend: round2(spend),
    leads,
    totalLeads,
    closedLeads,
    closedPipelineValue: round2(closedPipelineValue),
    acquiredCustomers,
    revenue: round2(revenue),
    cac: acquiredCustomers > 0 ? round2(spend / acquiredCustomers) : null,
    roas: spend > 0 ? round2(revenue / spend) : null,
    conversionRate: leads > 0 ? acquiredCustomers / leads : null,
    closedLeadRate: totalLeads > 0 ? closedLeads / totalLeads : null,
    averageClosedValue: closedLeads > 0 ? round2(closedPipelineValue / closedLeads) : null,
    currency: input.currency ?? 'EUR',
  }
}

/** ROAS visual cue: <1× loses money, 1–3× is marginal, ≥3× is healthy. */
export function roasTone(roas: number | null): StatTone {
  if (roas === null) return 'default'
  if (roas >= 3) return 'success'
  if (roas >= 1) return 'warning'
  return 'danger'
}
