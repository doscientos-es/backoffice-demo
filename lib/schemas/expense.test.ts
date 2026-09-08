import { describe, expect, it } from 'vitest'

import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  ExpenseCategory,
  ExpenseIdInput,
  ExpenseInput,
  ExpensePaymentSource,
  ExpenseRecurrence,
  ExpenseStatus,
  UpdateExpenseInput,
} from '@/lib/schemas/expense'

const uuid = '11111111-1111-1111-1111-111111111111'

const baseFields = {
  vendor: 'Hetzner',
  expense_date: '2025-01-10',
  subtotal: '100',
}

describe('expense enums', () => {
  it('expose canonical vocabularies', () => {
    expect(EXPENSE_CATEGORIES).toContain('hosting')
    expect(EXPENSE_STATUSES).toContain('paid')
    expect(ExpenseCategory.safeParse('hosting').success).toBe(true)
    expect(ExpenseStatus.safeParse('paid').success).toBe(true)
    expect(ExpenseRecurrence.safeParse('monthly').success).toBe(true)
    expect(ExpensePaymentSource.safeParse('company').success).toBe(true)
  })
})

describe('ExpenseInput payer refinement', () => {
  it('applies defaults and coerces subtotal', () => {
    const out = ExpenseInput.parse(baseFields)
    expect(out.subtotal).toBe(100)
    expect(out.payment_source).toBe('company')
    expect(out.currency).toHaveLength(3)
  })
  it('requires a payer when the source is a member', () => {
    expect(ExpenseInput.safeParse({ ...baseFields, payment_source: 'member' }).success).toBe(false)
    expect(
      ExpenseInput.safeParse({
        ...baseFields,
        payment_source: 'member',
        paid_by_member_id: uuid,
      }).success,
    ).toBe(true)
  })
  it('rejects a negative subtotal and a missing vendor', () => {
    expect(ExpenseInput.safeParse({ ...baseFields, subtotal: '-1' }).success).toBe(false)
    expect(ExpenseInput.safeParse({ ...baseFields, vendor: '' }).success).toBe(false)
  })
})

describe('UpdateExpenseInput / ExpenseIdInput', () => {
  it('requires an id and optimistic-lock version', () => {
    expect(UpdateExpenseInput.safeParse(baseFields).success).toBe(false)
    expect(UpdateExpenseInput.safeParse({ ...baseFields, id: uuid }).success).toBe(false)
    expect(
      UpdateExpenseInput.safeParse({ ...baseFields, id: uuid, expected_version: 1 }).success,
    ).toBe(true)
  })
  it('validates a bare uuid id', () => {
    expect(ExpenseIdInput.safeParse({ id: uuid }).success).toBe(true)
    expect(ExpenseIdInput.safeParse({ id: 'x' }).success).toBe(false)
  })
})
