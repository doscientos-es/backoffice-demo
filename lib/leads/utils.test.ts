import { describe, expect, it } from 'vitest'

import { getLeadInitials, leadDisplayName } from './utils'

describe('lead display helpers', () => {
  it('uses the alias for compact lead surfaces', () => {
    expect(leadDisplayName({ name: 'María García', alias: 'María' })).toBe('María')
  })

  it('falls back to the original name when the alias is empty', () => {
    expect(leadDisplayName({ name: 'María García', alias: '  ' })).toBe('María García')
  })

  it('computes initials from the compact display name', () => {
    expect(getLeadInitials({ name: 'María García', alias: 'María' })).toBe('M')
  })
})
