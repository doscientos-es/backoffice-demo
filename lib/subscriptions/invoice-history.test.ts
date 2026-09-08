import { describe, expect, it } from 'vitest'

import { getDefaultSubscriptionInvoiceId } from './invoice-history'

describe('getDefaultSubscriptionInvoiceId', () => {
  const today = new Date('2026-08-09T12:00:00')

  it('opens the latest completed monthly period instead of an invoice for the current month', () => {
    expect(
      getDefaultSubscriptionInvoiceId(
        [
          { id: 'august', subscription_period_start: '2026-08-01' },
          { id: 'july', subscription_period_start: '2026-07-01' },
          { id: 'june', subscription_period_start: '2026-06-01' },
        ],
        today,
      ),
    ).toBe('july')
  })

  it('falls back to the newest available invoice when there is no completed period', () => {
    expect(
      getDefaultSubscriptionInvoiceId(
        [{ id: 'august', subscription_period_start: '2026-08-01' }],
        today,
      ),
    ).toBe('august')
  })
})
