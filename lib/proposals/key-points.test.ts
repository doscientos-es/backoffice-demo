import { describe, expect, it } from 'vitest'

import {
  createEmptyKeyPoint,
  createEmptyPair,
  type EditablePair,
  parseKeyPoints,
  serializeKeyPoints,
  toEditableKeyPoints,
  unzipPairs,
  zipKeyPoints,
} from '@/lib/proposals/key-points'

describe('parseKeyPoints', () => {
  it('returns [] for non-array input', () => {
    expect(parseKeyPoints(null)).toEqual([])
    expect(parseKeyPoints(undefined)).toEqual([])
    expect(parseKeyPoints('nope')).toEqual([])
    expect(parseKeyPoints({})).toEqual([])
  })

  it('normalises entries and trims the title', () => {
    expect(parseKeyPoints([{ id: 'x', title: '  Hello  ', description: 'World' }])).toEqual([
      { id: 'x', title: 'Hello', description: 'World' },
    ])
  })

  it('drops entries without a usable title', () => {
    const out = parseKeyPoints([
      { title: '' },
      { title: '   ' },
      { description: 'orphan' },
      { title: 'keep' },
    ])
    expect(out).toEqual([{ id: 'kp-3', title: 'keep', description: null }])
  })

  it('synthesises an id from the index when missing or blank', () => {
    const out = parseKeyPoints([{ title: 'a' }, { id: '', title: 'b' }])
    expect(out.map((k) => k.id)).toEqual(['kp-0', 'kp-1'])
  })

  it('nulls out blank/whitespace descriptions', () => {
    const out = parseKeyPoints([{ title: 't', description: '   ' }])
    expect(out[0]?.description).toBeNull()
  })

  it('skips non-object array members (index is over the filtered array)', () => {
    const out = parseKeyPoints([42, 'str', null, { title: 'ok' }])
    expect(out).toEqual([{ id: 'kp-0', title: 'ok', description: null }])
  })
})

describe('toEditableKeyPoints', () => {
  it('hydrates null descriptions into empty strings', () => {
    expect(
      toEditableKeyPoints([
        { id: '1', title: 'a', description: null },
        { id: '2', title: 'b', description: 'd' },
      ]),
    ).toEqual([
      { id: '1', title: 'a', description: '' },
      { id: '2', title: 'b', description: 'd' },
    ])
  })
})

describe('serializeKeyPoints', () => {
  it('returns null for an empty list', () => {
    expect(serializeKeyPoints([])).toBeNull()
  })

  it('returns null when every entry is blank', () => {
    expect(
      serializeKeyPoints([
        { id: '1', title: '   ', description: 'x' },
        { id: '2', title: '', description: '' },
      ]),
    ).toBeNull()
  })

  it('trims, drops blank titles and collapses empty descriptions to null', () => {
    expect(
      serializeKeyPoints([
        { id: '1', title: '  Keep  ', description: '  desc  ' },
        { id: '2', title: '', description: 'skip' },
        { id: '3', title: 'NoDesc', description: '   ' },
      ]),
    ).toEqual([
      { id: '1', title: 'Keep', description: 'desc' },
      { id: '3', title: 'NoDesc', description: null },
    ])
  })

  it('round-trips through parse → toEditable → serialize', () => {
    const stored = parseKeyPoints([
      { id: 'a', title: 'Problema', description: 'Detalle' },
      { id: 'b', title: 'Solución', description: null },
    ])
    const editable = toEditableKeyPoints(stored)
    expect(serializeKeyPoints(editable)).toEqual(stored)
  })
})

describe('createEmptyKeyPoint', () => {
  it('creates a blank point with a non-empty unique id', () => {
    const a = createEmptyKeyPoint()
    const b = createEmptyKeyPoint()
    expect(a.title).toBe('')
    expect(a.description).toBe('')
    expect(a.id.length).toBeGreaterThan(0)
    expect(a.id).not.toBe(b.id)
  })
})

describe('createEmptyPair', () => {
  it('creates a blank pair with a non-empty unique id', () => {
    const a = createEmptyPair()
    const b = createEmptyPair()
    expect(a).toMatchObject({
      problem: '',
      problemDescription: '',
      solution: '',
      solutionDescription: '',
    })
    expect(a.id.length).toBeGreaterThan(0)
    expect(a.id).not.toBe(b.id)
  })
})

describe('zipKeyPoints', () => {
  it('pairs a problem with the solution sharing its id', () => {
    expect(
      zipKeyPoints(
        [{ id: 'a', title: 'P', description: 'pd' }],
        [{ id: 'a', title: 'S', description: 'sd' }],
      ),
    ).toEqual([
      { id: 'a', problem: 'P', problemDescription: 'pd', solution: 'S', solutionDescription: 'sd' },
    ])
  })

  it('falls back to positional order for legacy independent lists', () => {
    const pairs = zipKeyPoints(
      [
        { id: 'p1', title: 'P1' },
        { id: 'p2', title: 'P2' },
      ],
      [
        { id: 's1', title: 'S1' },
        { id: 's2', title: 'S2' },
      ],
    )
    expect(pairs.map((p) => [p.problem, p.solution])).toEqual([
      ['P1', 'S1'],
      ['P2', 'S2'],
    ])
    // The pair keeps the problem's id so a re-zip stays stable.
    expect(pairs.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('prefers id matches even when order differs', () => {
    const pairs = zipKeyPoints(
      [
        { id: 'a', title: 'Pa' },
        { id: 'b', title: 'Pb' },
      ],
      [
        { id: 'b', title: 'Sb' },
        { id: 'a', title: 'Sa' },
      ],
    )
    expect(pairs).toEqual([
      { id: 'a', problem: 'Pa', problemDescription: '', solution: 'Sa', solutionDescription: '' },
      { id: 'b', problem: 'Pb', problemDescription: '', solution: 'Sb', solutionDescription: '' },
    ])
  })

  it('keeps orphan solutions as solution-only pairs', () => {
    const pairs = zipKeyPoints(
      [{ id: 'a', title: 'P' }],
      [
        { id: 'a', title: 'S' },
        { id: 'x', title: 'Extra' },
      ],
    )
    expect(pairs).toHaveLength(2)
    expect(pairs[1]).toEqual({
      id: 'x',
      problem: '',
      problemDescription: '',
      solution: 'Extra',
      solutionDescription: '',
    })
  })

  it('leaves the solution blank when a problem has none', () => {
    const pairs = zipKeyPoints([{ id: 'a', title: 'P' }], [])
    expect(pairs).toEqual([
      { id: 'a', problem: 'P', problemDescription: '', solution: '', solutionDescription: '' },
    ])
  })
})

describe('unzipPairs', () => {
  it('splits pairs into two id-aligned lists', () => {
    const { problems, solutions } = unzipPairs([
      { id: 'a', problem: 'P', problemDescription: 'pd', solution: 'S', solutionDescription: 'sd' },
    ])
    expect(problems).toEqual([{ id: 'a', title: 'P', description: 'pd' }])
    expect(solutions).toEqual([{ id: 'a', title: 'S', description: 'sd' }])
  })

  it('round-trips pairs through unzip → zip', () => {
    const pairs: EditablePair[] = [
      { id: '1', problem: 'P1', problemDescription: 'd1', solution: 'S1', solutionDescription: '' },
      { id: '2', problem: 'P2', problemDescription: '', solution: 'S2', solutionDescription: 'd2' },
    ]
    const { problems, solutions } = unzipPairs(pairs)
    expect(zipKeyPoints(problems, solutions)).toEqual(pairs)
  })

  it('serializes cleanly, dropping the blank half of a one-sided pair', () => {
    const { problems, solutions } = unzipPairs([
      { id: 'a', problem: 'P', problemDescription: '', solution: '', solutionDescription: '' },
    ])
    expect(serializeKeyPoints(problems)).toEqual([{ id: 'a', title: 'P', description: null }])
    expect(serializeKeyPoints(solutions)).toBeNull()
  })
})
