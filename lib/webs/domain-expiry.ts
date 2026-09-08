export type ExpiryState = 'expired' | 'critical' | 'warning' | 'ok' | null

export function domainExpiryDays(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

export function domainExpiryState(days: number | null): ExpiryState {
  if (days === null) return null
  if (days < 0) return 'expired'
  if (days <= 14) return 'critical'
  if (days <= 60) return 'warning'
  return 'ok'
}
