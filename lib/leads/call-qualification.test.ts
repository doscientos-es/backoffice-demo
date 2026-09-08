import { describe, expect, it } from 'vitest'

import { isAutomaticallyAccessible, summarizeCallOutcomes } from './call-qualification'

describe('call qualification', () => {
  it('marks a lead accessible when answered calls outnumber missed attempts', () => {
    const summary = summarizeCallOutcomes([
      { payload: { outcome: 'connected' } },
      { payload: { outcome: 'no_answer' } },
      { payload: { outcome: 'connected' } },
    ])

    expect(summary).toMatchObject({ connected: 2, unanswered: 1, noAnswerStreak: 0 })
    expect(isAutomaticallyAccessible(summary)).toBe(true)
  })

  it('does not count a wrong number as a missed attempt and tracks only a current no-answer run', () => {
    const summary = summarizeCallOutcomes([
      { payload: { outcome: 'no_answer' } },
      { payload: { outcome: 'no_answer' } },
      { payload: { outcome: 'wrong_number' } },
      { payload: { outcome: 'connected' } },
    ])

    expect(summary).toMatchObject({ connected: 1, unanswered: 2, noAnswerStreak: 2 })
    expect(isAutomaticallyAccessible(summary)).toBe(false)
  })
})
