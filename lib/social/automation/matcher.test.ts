import { describe, expect, it } from 'vitest'

import { matchesAutomationKeyword, normalizeAutomationText, selectMatchingRule } from './matcher'

describe('social automation keyword matching', () => {
  it('ignores case and accents', () => {
    expect(normalizeAutomationText('  DoscIÉNTOS  ')).toBe('doscientos')
    expect(matchesAutomationKeyword('Me interesa DOSCIENTOS', 'doscientos')).toBe(true)
  })

  it('matches whole words and phrases only', () => {
    expect(matchesAutomationKeyword('doscientosx', 'doscientos')).toBe(false)
    expect(matchesAutomationKeyword('quiero doscientos euros', 'doscientos')).toBe(true)
    expect(matchesAutomationKeyword('quiero precio y presupuesto', 'precio y presupuesto')).toBe(
      true,
    )
  })

  it('prioritizes a post-specific rule over a global rule', () => {
    const rules = [
      { postId: null, keyword: 'doscientos' },
      { postId: 'post-1', keyword: 'doscientos' },
    ]
    expect(selectMatchingRule(rules, 'post-1', 'doscientos')?.postId).toBe('post-1')
  })
})
