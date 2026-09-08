import type { OgMetadata, SiteStatus } from './types'

const BOT_UA = 'doscientos-bot/1.0 (internal site inspector)'
const FETCH_TIMEOUT_MS = 8_000

// ─── Regex helpers ─────────────────────────────────────────────────────────────

function metaContent(html: string, attr: 'property' | 'name', value: string): string | null {
  // Handles both attribute orders: <meta property="..." content="..."> and vice-versa.
  for (const [a, b] of [
    [`${attr}=["']${value}["']`, `content=["']([^"'<>]+)["']`],
    [`content=["']([^"'<>]+)["']`, `${attr}=["']${value}["']`],
  ]) {
    const re = new RegExp(`<meta[^>]+${a}[^>]+${b}`, 'i')
    const m = html.match(re)
    if (m?.[1]) return decodeHTMLEntities(m[1].trim())
  }
  return null
}

function linkHref(html: string, rel: string): string | null {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"'<>]+)["']`, 'i')
  const m =
    html.match(re) ??
    html.match(new RegExp(`<link[^>]+href=["']([^"'<>]+)["'][^>]+rel=["']${rel}["']`, 'i'))
  return m?.[1]?.trim() ?? null
}

function pageTitle(html: string): string | null {
  return html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]?.trim() ?? null
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function fetchOgMetadata(url: string): Promise<OgMetadata> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': BOT_UA, Accept: 'text/html' },
      next: { revalidate: 0 },
    })
    const html = await res.text()

    const hostname = new URL(url).hostname

    return {
      title: metaContent(html, 'property', 'og:title') ?? pageTitle(html),
      description:
        metaContent(html, 'property', 'og:description') ?? metaContent(html, 'name', 'description'),
      image: metaContent(html, 'property', 'og:image'),
      siteName: metaContent(html, 'property', 'og:site_name'),
      type: metaContent(html, 'property', 'og:type'),
      ogUrl: metaContent(html, 'property', 'og:url'),
      twitterCard: metaContent(html, 'name', 'twitter:card'),
      twitterTitle: metaContent(html, 'name', 'twitter:title'),
      twitterImage: metaContent(html, 'name', 'twitter:image'),
      canonical: linkHref(html, 'canonical'),
      favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    }
  } catch {
    return {
      title: null,
      description: null,
      image: null,
      siteName: null,
      type: null,
      ogUrl: null,
      twitterCard: null,
      twitterTitle: null,
      twitterImage: null,
      canonical: null,
      favicon: null,
    }
  } finally {
    clearTimeout(t)
  }
}

export async function checkSiteStatus(url: string): Promise<SiteStatus> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 10_000)
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': BOT_UA },
      redirect: 'follow',
      next: { revalidate: 0 },
    })
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - start, error: null }
  } catch (err) {
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  } finally {
    clearTimeout(t)
  }
}
