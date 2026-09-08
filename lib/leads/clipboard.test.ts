import { describe, expect, it } from 'vitest'

import { parseLeadClipboard } from './clipboard'

describe('parseLeadClipboard', () => {
  it('extracts contact hints while preserving the original context as notes', () => {
    const result = parseLeadClipboard('Ana Pérez\nana@example.com\n+34 600 123 456\nQuiere una app')

    expect(result).toEqual({
      email: 'ana@example.com',
      phone: '+34 600 123 456',
      notes: 'Ana Pérez\nana@example.com\n+34 600 123 456\nQuiere una app',
    })
  })

  it('removes null bytes and bounds imported text', () => {
    expect(parseLeadClipboard(`Nota\u0000${'x'.repeat(5000)}`).notes).toHaveLength(4000)
  })
})
