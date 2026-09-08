import type { RecoverySignals, RecoveryState } from './types'

/**
 * Pure reducer mapping raw engagement signals to a funnel position. Ordered by
 * strength of intent so the strongest signal wins:
 *   engaged (replied/clicked) → opened → contacted → pending.
 */
export function getRecoveryState(signals: RecoverySignals): RecoveryState {
  if (signals.replied || signals.clicked) return 'engaged'
  if (signals.opened) return 'opened'
  if (signals.hasOutbound) return 'contacted'
  return 'pending'
}

/**
 * Whole days elapsed since an ISO timestamp, or null when absent. Used to
 * surface how long a lost lead has been sitting untouched.
 */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

/**
 * Builds a self-service Cal.com booking URL for a lost lead. Prefills the guest
 * name/email and stamps `metadata[leadId]` so the Cal webhook merges the booking
 * back into this same lead (see `mapCalToLeadIntake`). The resulting link is also
 * click-tracked by the email pipeline, so a booking click is a strong intent
 * signal. Returns null when no base link is configured or it is malformed.
 */
export function buildBookingUrl(
  base: string | null | undefined,
  lead: { id: string; name?: string | null; email?: string | null },
): string | null {
  const trimmed = base?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    url.searchParams.set('metadata[leadId]', lead.id)
    if (lead.name) url.searchParams.set('name', lead.name)
    if (lead.email) url.searchParams.set('email', lead.email)
    return url.toString()
  } catch {
    return null
  }
}
