export type SubscriptionInvoicePeriod = {
  id: string
  subscription_period_start: string | null
}

/**
 * Invoices are expected newest-first. Prefer the latest completed calendar
 * period so the subscription view opens on last month's billing by default.
 */
export function getDefaultSubscriptionInvoiceId(
  invoices: SubscriptionInvoicePeriod[],
  today = new Date(),
): string | null {
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const latestCompletedPeriod = invoices.find((invoice) => {
    if (!invoice.subscription_period_start) return false
    return new Date(`${invoice.subscription_period_start}T00:00:00`) < currentMonthStart
  })

  return latestCompletedPeriod?.id ?? invoices[0]?.id ?? null
}
