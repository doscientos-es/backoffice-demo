import { describe, expect, it } from 'vitest'

import { CreateClientInput, UpdateClientInput } from '@/lib/schemas/client'

const uuid = '11111111-1111-1111-1111-111111111111'

describe('CreateClientInput', () => {
  it('requires a name and collapses empty optionals', () => {
    const out = CreateClientInput.parse({ name: 'Acme', nif: '', email: '', phone: '' })
    expect(out.name).toBe('Acme')
    // optionalText keeps "" (union short-circuits); optionalEmail collapses to undefined.
    expect(out.nif).toBe('')
    expect(out.email).toBeUndefined()
  })
  it('rejects empty name and invalid email', () => {
    expect(CreateClientInput.safeParse({ name: '' }).success).toBe(false)
    expect(CreateClientInput.safeParse({ name: 'X', email: 'bad' }).success).toBe(false)
  })
})

describe('UpdateClientInput', () => {
  it('requires an id and optimistic-lock version', () => {
    expect(UpdateClientInput.safeParse({ name: 'X' }).success).toBe(false)
    expect(UpdateClientInput.safeParse({ id: uuid, name: 'X' }).success).toBe(false)
    expect(UpdateClientInput.parse({ id: uuid, name: 'X', expected_version: 1 }).id).toBe(uuid)
  })
})
