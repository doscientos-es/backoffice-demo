import { describe, expect, it } from 'vitest'

import { SubmitProjectRequestInput } from '@/lib/schemas/project-portal'

const valid = {
  token: 'a'.repeat(48),
  category: 'incident',
  subject: 'No puedo acceder',
  body: 'La pantalla muestra un error al iniciar sesión.',
  requesterName: 'Ana',
  requesterEmail: 'ana@example.test',
}

describe('SubmitProjectRequestInput', () => {
  it('accepts a bounded client request', () => {
    expect(SubmitProjectRequestInput.parse(valid)).toMatchObject(valid)
  })

  it('rejects unknown categories, invalid email and a filled honeypot', () => {
    expect(SubmitProjectRequestInput.safeParse({ ...valid, category: 'other' }).success).toBe(false)
    expect(SubmitProjectRequestInput.safeParse({ ...valid, requesterEmail: 'bad' }).success).toBe(
      false,
    )
    expect(SubmitProjectRequestInput.safeParse({ ...valid, website: 'spam' }).success).toBe(false)
  })
})
