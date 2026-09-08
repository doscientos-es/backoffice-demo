import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// State controlled per test
// ---------------------------------------------------------------------------
const db: {
  tasks: unknown[]
  myLeads: unknown[]
  unassigned: unknown[]
} = { tasks: [], myLeads: [], unassigned: [] }
const filters: Array<{ table: string; column: string; value: unknown }> = []

// ---------------------------------------------------------------------------
// Supabase server mock
// Each from() call returns an independent chain that tracks whether
// assigned_to was filtered with eq (owned) or is(null) (unassigned).
// The terminal .limit() resolves to the appropriate fixture.
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      let assignedToMode: 'owned' | 'unassigned' | null = null
      let isCountQuery = false

      const chain: Record<string, unknown> = {
        select: (_cols: unknown, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) isCountQuery = true
          return chain
        },
        eq: (col: string, value: unknown) => {
          filters.push({ table, column: col, value })
          if (col === 'assigned_to') assignedToMode = 'owned'
          return chain
        },
        is: (col: string, val: unknown) => {
          if (col === 'assigned_to' && val === null) assignedToMode = 'unassigned'
          return chain
        },
        not: (col: string, _operator: string, value: unknown) => {
          filters.push({ table, column: col, value })
          return chain
        },
        in: () => chain,
        gte: () => chain,
        lte: () => chain,
        order: () => chain,
        limit: async () => {
          if (isCountQuery) return { data: null, count: 0, error: null }
          if (table === 'tasks') return { data: db.tasks, error: null }
          if (assignedToMode === 'unassigned') return { data: db.unassigned, error: null }
          return { data: db.myLeads, error: null }
        },
        // Count queries (no .limit()) resolve here via Promise.all awaiting the chain.
        // Return count=0 and data=[] as defaults for test isolation.
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Supabase query chains
        then: (resolve: (v: unknown) => void) => {
          const result = isCountQuery
            ? { data: null, count: 0, error: null }
            : table === 'tasks'
              ? { data: db.tasks, error: null }
              : assignedToMode === 'unassigned'
                ? { data: db.unassigned, error: null }
                : { data: db.myLeads, error: null }
          Promise.resolve(result).then(resolve)
        },
        update: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
      }
      return chain
    },
  }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getMyDay', () => {
  beforeEach(() => {
    db.tasks = []
    db.myLeads = []
    db.unassigned = []
    filters.length = 0
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('returns empty arrays when there is no data', async () => {
    const { getMyDay } = await import('@/lib/dashboard/queries')
    const result = await getMyDay({ assigneeId: 'user-1' })

    expect(result.tasks).toEqual([])
    expect(result.myLeads).toEqual([])
    expect(result.unassignedLeads).toEqual([])
  })

  it('maps a task row into MyTaskRow shape', async () => {
    db.tasks = [
      {
        id: 't1',
        title: 'Preparar propuesta',
        status: 'todo',
        priority: 'high',
        due_date: '2026-06-10',
        projects: { name: 'Proyecto Alpha' },
        leads: null,
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { tasks } = await getMyDay({ assigneeId: 'user-1' })

    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      id: 't1',
      title: 'Preparar propuesta',
      status: 'todo',
      priority: 'high',
      due_date: '2026-06-10',
      contextLabel: 'Proyecto Alpha',
    })
  })

  it('uses lead name as contextLabel when task has no project', async () => {
    db.tasks = [
      {
        id: 't2',
        title: 'Llamar cliente',
        status: 'in_progress',
        priority: 'medium',
        due_date: null,
        projects: null,
        leads: { name: 'García SL' },
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { tasks } = await getMyDay({ assigneeId: 'user-1' })

    expect(tasks[0]?.contextLabel).toBe('García SL')
  })

  it('contextLabel is null when neither project nor lead is present', async () => {
    db.tasks = [
      {
        id: 't3',
        title: 'Revisar CRM',
        status: 'todo',
        priority: 'low',
        due_date: null,
        projects: null,
        leads: null,
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { tasks } = await getMyDay({ assigneeId: 'user-1' })

    expect(tasks[0]?.contextLabel).toBeNull()
  })

  it("maps a lead row into ActionLeadRow with updated_at as 'since'", async () => {
    db.myLeads = [
      {
        id: 'l1',
        name: 'Ana Fernández',
        company: 'Tech SL',
        phone: '+34600000001',
        email: 'ana@tech.com',
        status: 'qualifying',
        updated_at: '2026-05-20T10:00:00Z',
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { myLeads } = await getMyDay({ assigneeId: 'user-1' })

    expect(myLeads).toHaveLength(1)
    expect(myLeads[0]).toMatchObject({
      id: 'l1',
      name: 'Ana Fernández',
      company: 'Tech SL',
      status: 'qualifying',
      since: '2026-05-20T10:00:00Z',
    })
  })

  it("maps an unassigned lead with created_at as 'since'", async () => {
    db.unassigned = [
      {
        id: 'l2',
        name: 'Pedro Ruiz',
        company: null,
        phone: null,
        email: 'pedro@example.com',
        status: 'new',
        created_at: '2026-06-01T08:00:00Z',
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const { unassignedLeads } = await getMyDay({ assigneeId: 'user-1' })

    expect(unassignedLeads).toHaveLength(1)
    expect(unassignedLeads[0]).toMatchObject({
      id: 'l2',
      name: 'Pedro Ruiz',
      company: null,
      since: '2026-06-01T08:00:00Z',
    })
  })

  it('separates myLeads and unassignedLeads correctly', async () => {
    db.myLeads = [
      {
        id: 'owned',
        name: 'Owned',
        company: null,
        phone: null,
        email: null,
        status: 'new',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]
    db.unassigned = [
      {
        id: 'free',
        name: 'Free',
        company: null,
        phone: null,
        email: null,
        status: 'new',
        created_at: '2026-01-02T00:00:00Z',
      },
    ]

    const { getMyDay } = await import('@/lib/dashboard/queries')
    const result = await getMyDay({ assigneeId: 'user-1' })

    expect(result.myLeads.map((l) => l.id)).toEqual(['owned'])
    expect(result.unassignedLeads.map((l) => l.id)).toEqual(['free'])
  })

  it('does not constrain tasks or leads to a member for the team scope', async () => {
    const { getMyDay } = await import('@/lib/dashboard/queries')
    await getMyDay({ assigneeId: null })

    expect(filters.some((filter) => filter.column === 'assignee_id')).toBe(false)
    expect(filters).toContainEqual({ table: 'leads', column: 'assigned_to', value: null })
  })
})
