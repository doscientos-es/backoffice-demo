import { cn } from '@/lib/utils'

export const numberFmt = new Intl.NumberFormat('es-ES')
export const percentFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

// Visual cue thresholds — agreed with the user as starting points.
export const CPL_GOOD = 15
export const CPL_BAD = 25
export const CTR_GOOD = 1.5
export const CTR_BAD = 0.8

export function cplClass(cpl: number, leads: number): string {
  if (leads === 0) return 'text-muted-foreground'
  if (cpl <= CPL_GOOD) return 'text-emerald-600 dark:text-emerald-400'
  if (cpl >= CPL_BAD) return 'text-red-600 dark:text-red-400'
  return ''
}

export function ctrClass(ctr: number): string {
  if (ctr >= CTR_GOOD) return 'text-emerald-600 dark:text-emerald-400'
  if (ctr > 0 && ctr < CTR_BAD) return 'text-red-600 dark:text-red-400'
  return ''
}

export function cplTone(
  avgCpl: number,
  totalLeads: number,
): 'default' | 'success' | 'danger' | 'warning' {
  if (totalLeads === 0) return 'default'
  if (avgCpl <= CPL_GOOD) return 'success'
  if (avgCpl >= CPL_BAD) return 'danger'
  return 'warning'
}

export function buildAdsManagerUrl(adId: string, accountId: string | null): string | null {
  if (!accountId) return null
  const act = accountId.replace(/^act_/, '')
  return `https://www.facebook.com/adsmanager/manage/ads/edit?selected_ad_ids=${adId}&act=${act}`
}

export function buildCampaignManagerUrl(
  campaignId: string,
  accountId: string | null,
): string | null {
  if (!accountId || campaignId === '__none__') return null
  const act = accountId.replace(/^act_/, '')
  return `https://www.facebook.com/adsmanager/manage/campaigns/edit?selected_campaign_ids=${campaignId}&act=${act}`
}

export { cn }
