import type { ConversionEventRow } from './queries'

/** Dominio legible de una URL de referrer, o null si no se puede parsear. */
function referrerHost(referrer: string): string | null {
  try {
    return new URL(referrer).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Conclusión sobre de dónde viene el tráfico de un evento: prioriza UTMs
 * (campañas activas), luego el referrer, y por defecto asume tráfico directo
 * dentro de la propia web (típico de un clic en el pie o en el menú).
 */
export function trafficSource(
  event: Pick<ConversionEventRow, 'utm_source' | 'utm_medium' | 'utm_campaign' | 'referrer'>,
): string {
  if (event.utm_source) {
    const medium = event.utm_medium ? ` / ${event.utm_medium}` : ''
    const campaign = event.utm_campaign ? ` · ${event.utm_campaign}` : ''
    return `${event.utm_source}${medium}${campaign}`
  }
  if (event.referrer) {
    const host = referrerHost(event.referrer)
    if (host?.includes('google')) return 'Google (orgánico)'
    if (host?.includes('facebook') || host?.includes('instagram')) return 'Meta (orgánico)'
    if (host) return `Referido: ${host}`
  }
  return 'Directo'
}

export type VisitorJourney = {
  /** Clave interna de agrupación (visitor_id o lead_id fusionados). */
  key: string
  visitorIds: string[]
  lead: ConversionEventRow['lead']
  /** Eventos ordenados cronológicamente, más antiguo primero. */
  events: ConversionEventRow[]
  firstSeen: string
  lastSeen: string
  entryPath: string | null
  source: string
  hasWhatsappClick: boolean
  /** Grabación de la sesión en Microsoft Clarity, si la landing la capturó. */
  clarityUrl: string | null
}

/**
 * La landing adjunta la URL de reproducción de Clarity en el payload de los
 * eventos que envía por beacon (ver captureClarityPlayback en la landing).
 * Vale con encontrarla una vez: apunta al visitante, no al evento concreto.
 */
export function findClarityPlaybackUrl(events: ConversionEventRow[]): string | null {
  for (const event of events) {
    const url = event.payload?.clarity_url
    if (typeof url !== 'string') continue
    try {
      if (new URL(url).origin === 'https://clarity.microsoft.com') return url
    } catch {
      // Ignore malformed URLs received from the public tracking endpoint.
    }
  }
  return null
}

function journeyKeys(event: ConversionEventRow): string[] {
  const keys: string[] = []
  if (event.visitor_id) keys.push(`v:${event.visitor_id}`)
  if (event.lead_id) keys.push(`l:${event.lead_id}`)
  if (keys.length === 0) keys.push(`e:${event.id}`)
  return keys
}

/**
 * Agrupa eventos anónimos en "journeys" por visitante. Dos eventos caen en el
 * mismo journey si comparten visitor_id O lead_id — esto une, por ejemplo, el
 * clic de WhatsApp (con visitor_id) con el diagnóstico posterior ya asociado
 * al lead (solo con lead_id) en una única historia. Union-find simple sobre
 * claves "v:"/"l:"; los eventos sin ninguna de las dos quedan como journey de
 * un solo evento.
 */
export function groupIntoJourneys(events: ConversionEventRow[]): VisitorJourney[] {
  const parent = new Map<string, string>()

  function find(key: string): string {
    let root = key
    while (parent.get(root) !== root) {
      const next = parent.get(root)
      if (next === undefined) break
      root = next
    }
    let cur = key
    while (cur !== root) {
      const next = parent.get(cur)
      if (next === undefined) break
      parent.set(cur, root)
      cur = next
    }
    return root
  }

  function union(a: string, b: string) {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent.set(rootA, rootB)
  }

  for (const event of events) {
    const keys = journeyKeys(event)
    for (const key of keys) {
      if (!parent.has(key)) parent.set(key, key)
    }
    const [primary, ...rest] = keys
    if (primary) {
      for (const key of rest) union(primary, key)
    }
  }

  const buckets = new Map<string, ConversionEventRow[]>()
  for (const event of events) {
    const primary = journeyKeys(event)[0]
    if (primary === undefined) continue // journeyKeys() siempre devuelve al menos una clave
    const root = find(primary)
    const bucket = buckets.get(root)
    if (bucket) bucket.push(event)
    else buckets.set(root, [event])
  }

  const journeys: VisitorJourney[] = []
  for (const [key, group] of buckets) {
    const sorted = [...group].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    const entry = sorted[0]
    const last = sorted.at(-1)
    if (!entry || !last) continue // buckets nunca están vacíos, pero satisface a TS
    const visitorIds = [...new Set(sorted.map((e) => e.visitor_id).filter((v): v is string => !!v))]
    journeys.push({
      key,
      visitorIds,
      lead: sorted.find((e) => e.lead)?.lead ?? null,
      events: sorted,
      firstSeen: entry.created_at,
      lastSeen: last.created_at,
      entryPath: entry.landing_path,
      source: trafficSource(entry),
      hasWhatsappClick: sorted.some((e) => e.event_name === 'whatsapp_click'),
      clarityUrl: findClarityPlaybackUrl(sorted),
    })
  }

  journeys.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
  return journeys
}
