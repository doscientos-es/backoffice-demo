import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RawAdRow, RawInsightRow } from '@/lib/marketing/types'
import { INSIGHTS_OTHERS_KEY } from '@/lib/marketing/types'

// State controlled per test
const db: {
  ads: RawAdRow[]
} = { ads: [] }

/**
 * Build a fully-typed `RawInsightRow` from the subset of fields each test
 * actually cares about. Defaults mirror what Meta returns when an ad has no
 * impressions/clicks for that day, so aggregations stay deterministic.
 */
function insight(partial: Partial<RawInsightRow>): RawInsightRow {
  return {
    spend: null,
    impressions: null,
    clicks: null,
    ctr: null,
    cpc: null,
    total_leads: null,
    cost_per_lead: null,
    currency: null,
    date_start: null,
    date_stop: null,
    ...partial,
  }
}

type RawCampaignJoin = Extract<RawAdRow['marketing_campaigns'], { id: string | null }>

/** Build a fully-typed campaign reference for the `marketing_campaigns` join. */
function campaign(partial: { id: string; name: string }): RawCampaignJoin {
  return { ...partial, status: null, objective: null }
}

/** Build a fully-typed `RawAdRow` defaulting the fields tests don't exercise. */
function ad(
  partial: Pick<RawAdRow, 'id' | 'name'> & Partial<Omit<RawAdRow, 'id' | 'name'>>,
): RawAdRow {
  return {
    status: null,
    preview_url: null,
    updated_at: null,
    campaign_id: null,
    marketing_campaigns: null,
    marketing_insights: null,
    ...partial,
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() =>
    Promise.resolve({
      from: (_table: string) => {
        const chain = {
          select: () => Promise.resolve({ data: db.ads, error: null }),
        }
        return chain
      },
    }),
  ),
}))

// Mock Logger to keep output clean
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

describe('getInsightsBreakdownSeries', () => {
  const since = '2026-06-01'
  const until = '2026-06-03'

  beforeEach(() => {
    db.ads = []
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('aggregates data by day and entity (ads)', async () => {
    db.ads = [
      ad({
        id: 'ad_1',
        name: 'Ad 1',
        marketing_insights: [
          insight({ spend: 10, total_leads: 1, date_start: '2026-06-01', date_stop: '2026-06-01' }),
          insight({ spend: 20, total_leads: 0, date_start: '2026-06-02', date_stop: '2026-06-02' }),
        ],
      }),
      ad({
        id: 'ad_2',
        name: 'Ad 2',
        marketing_insights: [
          insight({ spend: 5, total_leads: 2, date_start: '2026-06-01', date_stop: '2026-06-01' }),
        ],
      }),
    ]

    const { getInsightsBreakdownSeries } = await import('@/lib/marketing/queries')
    const result = await getInsightsBreakdownSeries({ since, until, dimension: 'ads' })

    expect(result.points).toHaveLength(2)
    // Day 1
    const p1 = result.points.find((p) => p.date === '2026-06-01')
    expect(p1?.total).toBe(15)
    expect(p1?.leads).toBe(3)
    expect(p1?.ad_1).toBe(10)
    expect(p1?.ad_2).toBe(5)

    // Day 2
    const p2 = result.points.find((p) => p.date === '2026-06-02')
    expect(p2?.total).toBe(20)
    expect(p2?.ad_1).toBe(20)
    expect(p2?.ad_2).toBe(0) // Should be seeded
  })

  it("groups bottom spenders into 'Otros' (more than 6 entities)", async () => {
    // 8 ads. Top 6 should be separate, 7-8 should be "Otros"
    db.ads = Array.from({ length: 8 }, (_, i) =>
      ad({
        id: `ad_${i + 1}`,
        name: `Ad ${i + 1}`,
        marketing_insights: [
          // Each spend i+1, so ad_8 spends 8, ad_1 spends 1.
          insight({
            spend: i + 1,
            total_leads: 0,
            date_start: '2026-06-01',
            date_stop: '2026-06-01',
          }),
        ],
      }),
    )

    const { getInsightsBreakdownSeries } = await import('@/lib/marketing/queries')
    const result = await getInsightsBreakdownSeries({ since, until, dimension: 'ads' })

    // series should have 6 top + 1 "Otros" = 7
    expect(result.series).toHaveLength(7)
    expect(result.series.find((s) => s.key === INSIGHTS_OTHERS_KEY)).toBeDefined()

    const p1 = result.points[0]!
    // Top 6 are ad_8, ad_7, ad_6, ad_5, ad_4, ad_3 (spends 8, 7, 6, 5, 4, 3)
    // "Otros" are ad_2 (spend 2) and ad_1 (spend 1) => total 3
    expect(p1[INSIGHTS_OTHERS_KEY]).toBe(3)
    expect(p1.total).toBe(36) // sum(1..8) = 36
  })

  it('handles the campaigns dimension correctly', async () => {
    db.ads = [
      ad({
        id: 'ad_1',
        name: 'Ad 1',
        campaign_id: 'camp_1',
        marketing_campaigns: [campaign({ id: 'camp_1', name: 'Campaign 1' })],
        marketing_insights: [
          insight({
            spend: 100,
            total_leads: 1,
            date_start: '2026-06-01',
            date_stop: '2026-06-01',
          }),
        ],
      }),
      ad({
        id: 'ad_2',
        name: 'Ad 2',
        campaign_id: 'camp_1',
        marketing_campaigns: [campaign({ id: 'camp_1', name: 'Campaign 1' })],
        marketing_insights: [
          insight({
            spend: 50,
            total_leads: 1,
            date_start: '2026-06-01',
            date_stop: '2026-06-01',
          }),
        ],
      }),
    ]

    const { getInsightsBreakdownSeries } = await import('@/lib/marketing/queries')
    const result = await getInsightsBreakdownSeries({ since, until, dimension: 'campaigns' })

    expect(result.dimension).toBe('campaigns')
    expect(result.series).toHaveLength(1)
    expect(result.series[0]?.key).toBe('camp_1')
    expect(result.points[0]?.camp_1).toBe(150)
    expect(result.points[0]?.total).toBe(150)
  })

  it('filters by date range and ignores aggregates', async () => {
    db.ads = [
      ad({
        id: 'ad_1',
        name: 'Ad 1',
        marketing_insights: [
          // Within range
          insight({ spend: 10, total_leads: 1, date_start: '2026-06-02', date_stop: '2026-06-02' }),
          // Outside range (before)
          insight({
            spend: 100,
            total_leads: 1,
            date_start: '2026-05-31',
            date_stop: '2026-05-31',
          }),
          // Outside range (after)
          insight({
            spend: 200,
            total_leads: 1,
            date_start: '2026-06-04',
            date_stop: '2026-06-04',
          }),
          // Aggregate row (start !== stop)
          insight({
            spend: 500,
            total_leads: 1,
            date_start: '2026-06-01',
            date_stop: '2026-06-03',
          }),
        ],
      }),
    ]

    const { getInsightsBreakdownSeries } = await import('@/lib/marketing/queries')
    const result = await getInsightsBreakdownSeries({ since, until, dimension: 'ads' })

    expect(result.points).toHaveLength(1)
    expect(result.points[0]?.date).toBe('2026-06-02')
    expect(result.points[0]?.total).toBe(10)
  })
})
