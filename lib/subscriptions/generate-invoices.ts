import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('subscriptions.generate-invoices')
const MAX_PERIODS_PER_SUBSCRIPTION = 120

export type SubscriptionInvoiceRun = {
  checked: number
  generated: string[]
  failures: { subscriptionId: string; error: string }[]
}

/**
 * Generates every overdue recurring invoice. The database function locks each
 * subscription, reserves the invoice number and advances its internal cursor
 * in one transaction, so retries and concurrent cron runs cannot duplicate a
 * period.
 */
export async function generateDueSubscriptionInvoices(): Promise<SubscriptionInvoiceRun> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')
    .is('deleted_at', null)
    .lte('next_invoice_date', today)
    .order('next_invoice_date', { ascending: true })
    .limit(1_000)

  if (error) throw new Error(error.message)

  const generated: string[] = []
  const failures: SubscriptionInvoiceRun['failures'] = []

  for (const subscription of subscriptions ?? []) {
    const subscriptionId = subscription.id as string

    for (let period = 0; period < MAX_PERIODS_PER_SUBSCRIPTION; period += 1) {
      const { data: invoiceId, error: generateError } = await supabase.rpc(
        'generate_subscription_invoice',
        { p_subscription_id: subscriptionId },
      )

      if (generateError) {
        failures.push({ subscriptionId, error: generateError.message })
        log.error({ err: generateError, subscriptionId }, 'subscription_invoice_generation_failed')
        break
      }

      if (!invoiceId) break
      generated.push(invoiceId as string)

      if (period === MAX_PERIODS_PER_SUBSCRIPTION - 1) {
        const error = 'Se alcanzó el límite de periodos recuperados'
        failures.push({ subscriptionId, error })
        log.warn(
          { subscriptionId, maxPeriods: MAX_PERIODS_PER_SUBSCRIPTION },
          'catch_up_limit_reached',
        )
      }
    }
  }

  return { checked: subscriptions?.length ?? 0, generated, failures }
}
