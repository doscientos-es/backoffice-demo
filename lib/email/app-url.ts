const DEFAULT_EMAIL_APP_URL = 'https://app.doscientos.es'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'])

/**
 * Returns the public base URL for externally reachable links and callbacks.
 * Local development URLs cannot be reached by external services or recipients,
 * so they fall back to the canonical production application URL instead.
 */
export function externalAppUrl(appUrl: string | null | undefined): string {
  const candidate = appUrl?.trim()
  if (!candidate) return DEFAULT_EMAIL_APP_URL

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_EMAIL_APP_URL
    if (LOCAL_HOSTNAMES.has(url.hostname)) return DEFAULT_EMAIL_APP_URL
    return candidate.replace(/\/+$/, '')
  } catch {
    return DEFAULT_EMAIL_APP_URL
  }
}
