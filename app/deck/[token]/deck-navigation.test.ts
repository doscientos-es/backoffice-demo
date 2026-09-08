import { describe, expect, it } from 'vitest'

import { getDeckTapDirection } from './deck-navigation'

describe('getDeckTapDirection', () => {
  it('goes backwards when the tap is on the left half', () => {
    expect(getDeckTapDirection(120, 100, 600)).toBe('prev')
  })

  it('goes forwards when the tap is on the right half', () => {
    expect(getDeckTapDirection(680, 100, 600)).toBe('next')
  })
})
