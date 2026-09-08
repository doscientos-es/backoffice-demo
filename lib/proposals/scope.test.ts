import { describe, expect, it } from 'vitest'

import {
  parsePaymentPlan,
  paymentPlanForSchedule,
  paymentPlanInput,
  splitItemsForPaymentPlan,
} from './scope'

describe('payment plans', () => {
  it('creates an immediately useful 50/50 plan', () => {
    expect(paymentPlanForSchedule('half_half')).toEqual([
      expect.objectContaining({ id: 'acceptance', percentage: 50 }),
      expect.objectContaining({ id: 'delivery', percentage: 50 }),
    ])
  })

  it('requires configured plans to total exactly 100 percent', () => {
    expect(
      paymentPlanInput.safeParse([
        { id: 'one', title: 'Señal', percentage: 60, due_date: null },
        { id: 'two', title: 'Final', percentage: 30, due_date: null },
      ]).success,
    ).toBe(false)
  })

  it('allocates every source-line cent across the payment plan', () => {
    const plan = paymentPlanForSchedule('30_40_30')
    const totals = plan.map((_, index) =>
      splitItemsForPaymentPlan(
        [{ description: 'Servicio', quantity: 1, unit_price: 100.01, vat_rate: 21 }],
        plan,
        index,
      ).reduce((sum, item) => sum + item.unit_price, 0),
    )

    expect(totals).toEqual([30, 40, 30.01])
  })

  it('treats malformed legacy JSON as an unconfigured plan', () => {
    expect(parsePaymentPlan([{ id: 'bad', title: '', percentage: 100 }])).toEqual([])
  })
})
