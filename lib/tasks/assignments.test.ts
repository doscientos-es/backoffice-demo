import { describe, expect, it } from 'vitest'

import { mergeTaskMemberIds, normalizeTaskMemberIds } from './assignments'

describe('mergeTaskMemberIds', () => {
  it('keeps the legacy primary assignee when no relation rows exist', () => {
    expect(mergeTaskMemberIds('primary', [])).toEqual(['primary'])
  })

  it('merges collaborators without duplicating the primary assignee', () => {
    expect(mergeTaskMemberIds('primary', ['primary', 'gerard', null, undefined])).toEqual([
      'primary',
      'gerard',
    ])
  })
})

describe('normalizeTaskMemberIds', () => {
  it('assigns the creator as primary when no members are selected', () => {
    expect(normalizeTaskMemberIds('creator', [])).toEqual(['creator'])
  })

  it('preserves explicit order and removes duplicate members', () => {
    expect(normalizeTaskMemberIds('creator', ['other', 'creator', 'other'])).toEqual([
      'other',
      'creator',
    ])
  })
})
