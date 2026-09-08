import { describe, expect, it } from 'vitest'

import { invoiceConcepts } from './queries'

describe('invoiceConcepts', () => {
  it('returns non-empty concepts in invoice line order', () => {
    expect(
      invoiceConcepts([
        { description: 'Mantenimiento', position: 2 },
        { description: '  Diseño web  ', position: 0 },
        { description: '', position: 1 },
      ]),
    ).toEqual(['Diseño web', 'Mantenimiento'])
  })
})
