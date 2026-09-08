import { describe, expect, it } from 'vitest'

import { requiresCyaProspectSoftwareCommission } from './attribution'

describe('requiresCyaProspectSoftwareCommission', () => {
  it('recognises the CYA campaign independently of whitespace or casing', () => {
    expect(requiresCyaProspectSoftwareCommission(' CYA - prosp software ')).toBe(true)
  })

  it('does not flag other campaigns', () => {
    expect(requiresCyaProspectSoftwareCommission('PROSP SOFTWARE')).toBe(false)
    expect(requiresCyaProspectSoftwareCommission(null)).toBe(false)
  })
})