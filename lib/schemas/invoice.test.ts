import { describe, expect, it } from 'vitest'

import {
  CreateInvoiceFromProposalInput,
  CreateRectificationInput,
  InvoiceIdInput,
  InvoiceStatus,
  SendInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
} from '@/lib/schemas/invoice'

const uuid = '11111111-1111-1111-1111-111111111111'

describe('InvoiceStatus', () => {
  it('validates members', () => {
    expect(InvoiceStatus.parse('paid')).toBe('paid')
    expect(InvoiceStatus.safeParse('nope').success).toBe(false)
  })
  it('includes rectified', () => {
    expect(InvoiceStatus.parse('rectified')).toBe('rectified')
  })
})

describe('id payloads', () => {
  it('validate uuid shapes', () => {
    expect(InvoiceIdInput.safeParse({ id: uuid }).success).toBe(true)
    expect(SendInvoiceInput.safeParse({ id: 'x' }).success).toBe(false)
    expect(CreateInvoiceFromProposalInput.safeParse({ proposalId: uuid }).success).toBe(true)
  })
})

describe('UpdateInvoiceInput', () => {
  it('requires at least one line item when items provided', () => {
    expect(UpdateInvoiceInput.safeParse({ id: uuid, expected_version: 1, items: [] }).success).toBe(
      false,
    )
  })
  it('coerces line items and defaults', () => {
    const out = UpdateInvoiceInput.parse({
      id: uuid,
      expected_version: 1,
      items: [{ description: 'Servicio', quantity: '2', unit_price: '50' }],
    })
    expect(out.items?.[0]?.quantity).toBe(2)
    expect(out.items?.[0]?.vat_rate).toBe(21)
    expect(out.items?.[0]?.billing_cycle).toBe('none')
  })
  it('requires the version loaded by the editor', () => {
    expect(UpdateInvoiceInput.safeParse({ id: uuid }).success).toBe(false)
    expect(UpdateInvoiceInput.safeParse({ id: uuid, expected_version: 1 }).success).toBe(true)
  })
})

describe('UpdateInvoiceStatusInput', () => {
  it('validates id + status', () => {
    expect(UpdateInvoiceStatusInput.safeParse({ id: uuid, status: 'issued' }).success).toBe(true)
    expect(UpdateInvoiceStatusInput.safeParse({ id: uuid, status: 'nope' }).success).toBe(false)
  })
})

describe('CreateRectificationInput', () => {
  const base = { originalInvoiceId: uuid, rectificationType: 'R1', reason: 'Error en importe' }

  it('accepts R1 and R4 types', () => {
    expect(CreateRectificationInput.safeParse(base).success).toBe(true)
    expect(CreateRectificationInput.safeParse({ ...base, rectificationType: 'R4' }).success).toBe(
      true,
    )
  })

  it('rejects unknown rectification types', () => {
    expect(CreateRectificationInput.safeParse({ ...base, rectificationType: 'R2' }).success).toBe(
      false,
    )
    expect(CreateRectificationInput.safeParse({ ...base, rectificationType: 'R5' }).success).toBe(
      false,
    )
  })

  it('requires a non-empty reason', () => {
    expect(CreateRectificationInput.safeParse({ ...base, reason: '' }).success).toBe(false)
  })

  it('rejects reason longer than 500 chars', () => {
    expect(CreateRectificationInput.safeParse({ ...base, reason: 'a'.repeat(501) }).success).toBe(
      false,
    )
    expect(CreateRectificationInput.safeParse({ ...base, reason: 'a'.repeat(500) }).success).toBe(
      true,
    )
  })

  it('requires originalInvoiceId to be a UUID', () => {
    expect(
      CreateRectificationInput.safeParse({ ...base, originalInvoiceId: 'not-a-uuid' }).success,
    ).toBe(false)
  })
})
