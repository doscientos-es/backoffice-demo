'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { getMetaAdPreview, type MetaAdPreviewFormat } from '@/lib/integrations/meta-marketing'
import { scopedLogger } from '@/lib/logger'
import {
  getMarketingSyncErrorMessage,
  syncMetaCatalog,
  syncMetaInsights,
  syncMetaSpendToExpenses,
} from '@/lib/marketing-sync'
import { metaHistoryFloor, parseMarketingRange, rangeToDates } from '@/lib/marketing/range'

const log = scopedLogger('marketing-actions')

export async function syncMetaAction(
  rangeKey?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  try {
    const catalogResult = await syncMetaCatalog()
    if (!catalogResult.ok) {
      log.error({ err: catalogResult.error }, 'meta_catalog_sync_action_failed')
      return { ok: false, error: catalogResult.error ?? 'Error al sincronizar catálogo' }
    }

    // Sync the requested window (so longer ranges like "Histórico" actually
    // pull their data), but never less than the last 90 days — so smaller
    // ranges stay fresh without re-hitting the API on every switch — and never
    // earlier than Meta's 37-month historical limit.
    const { since: requestedSince } = rangeToDates(parseMarketingRange(rangeKey))
    const today = new Date().toISOString().split('T')[0] ?? ''
    const ninetyDaysAgo =
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? ''
    const floor = metaHistoryFloor()
    let since = requestedSince < ninetyDaysAgo ? requestedSince : ninetyDaysAgo
    if (since < floor) since = floor

    const insightsResult = await syncMetaInsights(since, today)
    if (!insightsResult.ok) {
      log.error({ err: insightsResult.error, since, today }, 'meta_insights_sync_action_failed')
      return { ok: false, error: insightsResult.error ?? 'Error al sincronizar métricas' }
    }

    // Mirror the synced spend into the finance module as monthly expenses so it
    // flows into cash-flow and P&L. A failure here shouldn't fail the whole
    // sync (metrics are already persisted), so we log and continue.
    const spendResult = await syncMetaSpendToExpenses(since, today)
    if (!spendResult.ok) {
      log.error({ err: spendResult.error, since, today }, 'meta_spend_sync_action_failed')
      return { ok: false, error: spendResult.error ?? 'Error al sincronizar el gasto en finanzas' }
    }

    revalidatePath('/finance')
    revalidatePath('/finance/expenses')

    return { ok: true }
  } catch (err) {
    log.error({ err }, 'meta_sync_action_failed')
    return {
      ok: false,
      error: getMarketingSyncErrorMessage(err),
    }
  }
}

export async function getAdPreviewAction(
  adId: string,
  format: MetaAdPreviewFormat = 'DESKTOP_FEED_STANDARD',
): Promise<{ ok: true; body: string | null } | { ok: false; error: string }> {
  await requireUser()
  try {
    const body = await getMetaAdPreview(adId, format)
    return { ok: true, body }
  } catch (err) {
    return {
      ok: false,
      error: getMarketingSyncErrorMessage(err),
    }
  }
}
