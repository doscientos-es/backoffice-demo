import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  tasks: [] as Record<string, unknown>[],
  campaigns: [] as Record<string, unknown>[],
  ads: [] as Record<string, unknown>[],
  detailLead: null as Record<string, unknown> | null,
  detailLeadError: null as string | null,
  companyResearch: null as Record<string, unknown> | null,
  companyResearchError: null as string | null,
  leadSelect: '',
  leadSelections: [] as string[],
  inCalls: [] as [string, unknown[]][],
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      let selection = ''
      const result = {
        data:
          table === 'leads'
            ? state.rows
            : table === 'tasks'
              ? state.tasks
              : table === 'marketing_campaigns'
                ? state.campaigns
              : table === 'marketing_ads'
                ? state.ads
                : [],
        error: null,
        count: table === 'leads' ? state.rows.length : null,
      }
      // `then` makes the builder awaitable for chains that don't end in
      // `limit()` (the next-action query ends in `order()`).
      const builder = {
        select(selectedColumns: string) {
          if (table === 'leads') {
            state.leadSelect = selectedColumns
            state.leadSelections.push(selectedColumns)
          }
          selection = selectedColumns
          return builder
        },
        eq: () => builder,
        is: () => builder,
        order: () => builder,
        or: () => builder,
        in: (column: string, values: unknown[]) => {
          if (table === 'leads') state.inCalls.push([column, values])
          return builder
        },
        limit: async () => result,
        async maybeSingle() {
          if (table === 'leads' && selection.includes('company_research')) {
            return {
              data: state.companyResearch,
              error: state.companyResearchError ? { message: state.companyResearchError } : null,
            }
          }
          if (table === 'leads') {
            return {
              data: state.detailLead,
              error: state.detailLeadError ? { message: state.detailLeadError } : null,
            }
          }
          if (table === 'marketing_ads') {
            return { data: state.ads[0] ?? null, error: null }
          }
          return { data: null, error: null }
        },
        // biome-ignore lint/suspicious/noThenProperty: mock needs to be thenable to mimic Supabase query builder
        then: (resolve: (value: typeof result) => unknown) => resolve(result),
      }
      return builder
    },
  }),
}))

import { getLeadDetail, listLeads } from './queries'

describe('listLeads client avatar enrichment', () => {
  beforeEach(() => {
    state.rows = []
    state.tasks = []
    state.campaigns = []
    state.ads = []
    state.detailLead = null
    state.detailLeadError = null
    state.companyResearch = null
    state.companyResearchError = null
    state.leadSelect = ''
    state.leadSelections = []
    state.inCalls = []
  })

  it('maps the linked client logo and keeps unconverted leads without a client', async () => {
    state.rows = [
      {
        id: 'lead-1',
        name: 'María García',
        status: 'new',
        created_at: '2026-07-16T10:00:00.000Z',
        updated_at: '2026-07-16T10:00:00.000Z',
        client: [{ name: 'Acme SL', logo_url: 'https://cdn.example/acme.png' }],
      },
      {
        id: 'lead-2',
        name: 'Jorge Pérez',
        status: 'new',
        created_at: '2026-07-15T10:00:00.000Z',
        updated_at: '2026-07-15T10:00:00.000Z',
        client: [],
      },
    ]

    const result = await listLeads({
      view: 'board',
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(state.leadSelect).toContain('client:clients!lead_id(name, logo_url)')
    expect(result.leads[0]?.client).toEqual({
      name: 'Acme SL',
      logo_url: 'https://cdn.example/acme.png',
    })
    expect(result.leads[1]?.client).toBeNull()
  })

  it('attaches the soonest pending reminder as the lead next action', async () => {
    state.rows = [
      {
        id: 'lead-1',
        name: 'María García',
        status: 'contacted',
        created_at: '2026-07-16T10:00:00.000Z',
        updated_at: '2026-07-16T10:00:00.000Z',
        client: [],
      },
      {
        id: 'lead-2',
        name: 'Jorge Pérez',
        status: 'contacted',
        created_at: '2026-07-15T10:00:00.000Z',
        updated_at: '2026-07-15T10:00:00.000Z',
        client: [],
      },
    ]
    // Ordered ascending by the query: only the first reminder per lead counts.
    state.tasks = [
      {
        id: 'task-1',
        lead_id: 'lead-1',
        title: 'Enviar email',
        start_at: '2026-07-20T09:00:00.000Z',
        action_type: 'email',
      },
      {
        id: 'task-2',
        lead_id: 'lead-1',
        title: 'Reunión',
        start_at: '2099-07-22T09:00:00.000Z',
        action_type: 'meeting',
      },
    ]

    const result = await listLeads({
      view: 'board',
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(result.leads[0]?.next_action).toEqual({
      id: 'task-1',
      title: 'Enviar email',
      remind_at: '2026-07-20T09:00:00.000Z',
      action_type: 'email',
    })
    expect(result.leads[0]?.scheduled_meeting_at).toBe('2099-07-22T09:00:00.000Z')
    expect(result.leads[1]?.next_action).toBeNull()
  })

  it('resolves a Meta lead campaign name from the synced campaign catalog', async () => {
    state.rows = [
      {
        id: 'lead-1',
        name: 'María García',
        status: 'new',
        created_at: '2026-07-16T10:00:00.000Z',
        updated_at: '2026-07-16T10:00:00.000Z',
        utm_campaign: 'campaign-cya',
      },
    ]
    state.campaigns = [{ id: 'campaign-cya', name: 'CYA - PROSP SOFTWARE' }]

    const result = await listLeads({
      view: 'board',
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(state.leadSelect).toContain('utm_campaign')
    expect(result.leads[0]?.marketing_campaign_name).toBe('CYA - PROSP SOFTWARE')
  })

  it('limits a notification summary view to its lead ids', async () => {
    await listLeads({
      view: 'board',
      ids: ['lead-1', 'lead-2'],
      q: '',
      status: null,
      source: null,
      solutionType: null,
      assignee: null,
      attention: null,
      page: 1,
    })

    expect(state.inCalls).toContainEqual(['id', ['lead-1', 'lead-2']])
  })
})

describe('getLeadDetail resilience', () => {
  beforeEach(() => {
    state.rows = []
    state.tasks = []
    state.campaigns = []
    state.ads = []
    state.detailLead = { id: 'lead-1', name: 'María García', utm_campaign: null }
    state.detailLeadError = null
    state.companyResearch = null
    state.companyResearchError = null
    state.leadSelect = ''
    state.leadSelections = []
    state.inCalls = []
  })

  it('keeps an existing lead available when optional company-research fields are unavailable', async () => {
    state.companyResearchError = 'column company_research does not exist'

    const result = await getLeadDetail('lead-1')

    expect(result?.lead.id).toBe('lead-1')
    expect(result?.companyResearchAvailable).toBe(false)
    expect(result?.lead.company_research).toBeNull()
  })

  it('throws a query failure instead of treating it as a missing lead', async () => {
    state.detailLeadError = 'permission denied for table leads'

    await expect(getLeadDetail('lead-1')).rejects.toThrow('No se pudo cargar el lead.')
  })

  it('resolves the Meta ad name from the ID stored in UTM content', async () => {
    state.detailLead = {
      id: 'lead-1',
      name: 'María García',
      utm_campaign: 'campaign-1',
      utm_content: 'ad-1',
    }
    state.campaigns = [{ id: 'campaign-1', name: 'Campaña captación' }]
    state.ads = [{ id: 'ad-1', name: 'Vídeo casos de éxito' }]

    const result = await getLeadDetail('lead-1')

    expect(state.leadSelections.some((selection) => selection.includes('utm_content'))).toBe(true)
    expect(result?.lead.marketing_campaign_name).toBe('Campaña captación')
    expect(result?.lead.marketing_ad_name).toBe('Vídeo casos de éxito')
  })
})
