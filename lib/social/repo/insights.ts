/**
 * Social Hub — insights repository.
 *
 * Upserts the latest metrics snapshot per target (unique target_id) and reads
 * them back for the analytics view. Sync writes use the admin client (they run
 * from background jobs without a user session); reads use the RLS server client.
 */
import { scopedLogger } from '@/lib/logger'
import type { PostInsights } from '@/lib/social/core'
import type { InsightsView } from '@/lib/social/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('social-repo-insights')

interface InsightsRow {
  target_id: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  video_views: number
  actions: number
  engagement_rate: number
  fetched_at: string
}

function mapInsights(row: InsightsRow): InsightsView {
  return {
    impressions: row.impressions,
    reach: row.reach,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    videoViews: row.video_views,
    actions: row.actions ?? 0,
    engagementRate: Number(row.engagement_rate),
    fetchedAt: row.fetched_at,
  }
}

/** Upsert the metrics snapshot for a target. */
export async function upsertInsights(targetId: string, insights: PostInsights): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('social_post_insights').upsert(
    {
      target_id: targetId,
      impressions: insights.impressions,
      reach: insights.reach,
      likes: insights.likes,
      comments: insights.comments,
      shares: insights.shares,
      saves: insights.saves,
      video_views: insights.videoViews,
      actions: insights.actions ?? 0,
      engagement_rate: insights.engagementRate,
      raw: insights.raw ?? {},
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'target_id' },
  )
  if (error) log.error({ targetId, err: error.message }, 'upsert_insights_failed')
}

/** Fetch latest insights keyed by target id for the given targets. */
export async function getInsightsByTarget(targetIds: string[]): Promise<Map<string, InsightsView>> {
  if (targetIds.length === 0) return new Map()
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('social_post_insights')
    .select(
      'target_id, impressions, reach, likes, comments, shares, saves, video_views, actions, engagement_rate, fetched_at',
    )
    .in('target_id', targetIds)
  if (error) {
    log.error({ err: error.message }, 'get_insights_failed')
    return new Map()
  }
  return new Map((data as unknown as InsightsRow[]).map((r) => [r.target_id, mapInsights(r)]))
}
