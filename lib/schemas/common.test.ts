import { describe, expect, it } from 'vitest'

import {
  assignableUuid,
  emptyToUndef,
  formDataToObject,
  lineItemInput,
  optionalDate,
  optionalEmail,
  optionalText,
  optionalUuid,
  requiredText,
  uuidIdInput,
} from '@/lib/schemas/common'

const uuid = '11111111-1111-1111-1111-111111111111'

describe('string coercion primitives', () => {
  it("emptyToUndef maps '' to undefined", () => {
    expect(emptyToUndef.parse('')).toBeUndefined()
  })
  it("optionalUuid accepts uuid, '' and rejects garbage", () => {
    expect(optionalUuid.parse('')).toBeUndefined()
    expect(optionalUuid.parse(uuid)).toBe(uuid)
    expect(optionalUuid.safeParse('nope').success).toBe(false)
  })
  it("assignableUuid coerces '' to null", () => {
    expect(assignableUuid.parse('')).toBeNull()
    expect(assignableUuid.parse(null)).toBeNull()
    expect(assignableUuid.parse(uuid)).toBe(uuid)
  })
  it("optionalDate collapses '' to undefined but keeps real dates", () => {
    expect(optionalDate.parse('')).toBeUndefined()
    expect(optionalDate.parse(undefined)).toBeUndefined()
    expect(optionalDate.parse('2025-01-01')).toBe('2025-01-01')
  })
  it('optionalEmail validates or collapses', () => {
    expect(optionalEmail.parse('')).toBeUndefined()
    expect(optionalEmail.parse('a@b.com')).toBe('a@b.com')
    expect(optionalEmail.safeParse('bad').success).toBe(false)
  })
})

describe('text factories', () => {
  it("optionalText enforces max and accepts ''", () => {
    // z.string() accepts "" so the union short-circuits before emptyToUndef;
    // optionalText therefore keeps "" rather than coercing it to undefined.
    expect(optionalText(5).parse('')).toBe('')
    expect(optionalText(5).parse('abc')).toBe('abc')
    expect(optionalText(2, 'demasiado').safeParse('abcdef').success).toBe(false)
  })
  it('requiredText trims and enforces min/max', () => {
    expect(requiredText(10, 'req').parse('  hi  ')).toBe('hi')
    expect(requiredText(10, 'req').safeParse('').success).toBe(false)
    expect(requiredText(2, 'req').safeParse('abc').success).toBe(false)
  })
})

describe('formDataToObject', () => {
  it('keeps only string entries', () => {
    const fd = new FormData()
    fd.append('name', 'Acme')
    fd.append('file', new Blob(['x']), 'x.txt')
    const out = formDataToObject(fd)
    expect(out.name).toBe('Acme')
    expect(out.file).toBeUndefined()
  })
})

describe('shared object schemas', () => {
  it('uuidIdInput validates the id', () => {
    expect(uuidIdInput.safeParse({ id: uuid }).success).toBe(true)
  })
  it('lineItemInput coerces numbers and applies defaults', () => {
    const out = lineItemInput.parse({ description: 'X', quantity: '2', unit_price: '10' })
    expect(out.quantity).toBe(2)
    expect(out.vat_rate).toBe(21)
    expect(out.billing_cycle).toBe('none')
    expect(
      lineItemInput.safeParse({ description: '', quantity: '0', unit_price: '1' }).success,
    ).toBe(false)
  })
})
