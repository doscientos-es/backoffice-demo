import { lookup } from 'node:dns/promises'

export type CompanyResearchSource = {
  title: string
  url: string
  excerpt: string
}

export type CompanyResearch = {
  domain: string
  description: string
  sector: string | null
  services: string[]
  location: string | null
  company_size: string | null
  fit: string
  priority: 'high' | 'medium' | 'low'
  confidence: number
  reasons: string[]
  cautions: string[]
  sources: CompanyResearchSource[]
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'proton.me',
  'protonmail.com',
])

const PAGE_HINT = /sobre|quienes-somos|nosotros|empresa|servicios|solutions|about|company/i
const MAX_PAGE_BYTES = 350_000

export function corporateDomainFromEmail(email: string | null | undefined): string | null {
  const domain = email?.trim().toLowerCase().split('@')[1]?.replace(/\.$/, '')
  if (!domain || FREE_EMAIL_DOMAINS.has(domain) || !domain.includes('.')) return null
  return domain
}

function isPrivateAddress(address: string): boolean {
  const value = address.toLowerCase()
  if (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fe80:') ||
    value.startsWith('fc') ||
    value.startsWith('fd')
  )
    return true
  const [first = 0, second = 0] = value.split('.').map(Number)
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  )
}

async function isPublicHostname(hostname: string): Promise<boolean> {
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local')) return false
  try {
    const addresses = await lookup(hostname, { all: true })
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address))
  } catch {
    return false
  }
}

function allowedUrl(value: URL, domain: string): boolean {
  return (
    value.protocol === 'https:' &&
    value.port === '' &&
    (value.hostname === domain || value.hostname === `www.${domain}`)
  )
}

async function fetchPublicPage(url: URL, domain: string, redirects = 0): Promise<Response> {
  if (redirects > 3 || !allowedUrl(url, domain) || !(await isPublicHostname(url.hostname))) {
    throw new Error('La web corporativa no es accesible de forma segura.')
  }
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: 'text/html,application/xhtml+xml' },
  })
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) throw new Error('La web corporativa devolvió una redirección no válida.')
    return fetchPublicPage(new URL(location, url), domain, redirects + 1)
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('No se pudo leer una página pública de la empresa.')
  }
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_PAGE_BYTES) throw new Error('La página corporativa es demasiado grande.')
  return response
}

function normalizeText(value: string): string {
  return value
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<!--([\s\S]*?)-->/gi,
      ' ',
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractCompanyPage(
  html: string,
  url: string,
  fallbackTitle: string,
): CompanyResearchSource {
  const title = normalizeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(
    0,
    160,
  )
  return { title: title || fallbackTitle, url, excerpt: normalizeText(html).slice(0, 1_600) }
}

function relatedPages(html: string, base: URL, domain: string): URL[] {
  const candidates = [...html.matchAll(/<a\b[^>]*href=["']([^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .flatMap((match) => {
      const [href, label = ''] = [match[1], match[2]]
      if (!href) return []
      try {
        return [{ url: new URL(href, base), label: normalizeText(label) }]
      } catch {
        return []
      }
    })
    .filter(
      ({ url, label }) =>
        allowedUrl(url, domain) && (PAGE_HINT.test(url.pathname) || PAGE_HINT.test(label)),
    )
    .map(({ url }) => url)
  return [...new Map(candidates.map((url) => [url.href, url])).values()].slice(0, 2)
}

export async function collectCompanySources(
  domain: string,
  onSource: (source: CompanyResearchSource) => void,
): Promise<CompanyResearchSource[]> {
  let response: Response
  try {
    response = await fetchPublicPage(new URL(`https://${domain}`), domain)
  } catch {
    response = await fetchPublicPage(new URL(`https://www.${domain}`), domain)
  }
  const homepageHtml = await response.text()
  const homepage = extractCompanyPage(homepageHtml, response.url, 'Página principal')
  const sources = [homepage]
  onSource(homepage)

  for (const page of relatedPages(homepageHtml, new URL(response.url), domain)) {
    try {
      const detailResponse = await fetchPublicPage(page, domain)
      const source = extractCompanyPage(
        await detailResponse.text(),
        detailResponse.url,
        'Página corporativa',
      )
      if (source.excerpt) {
        sources.push(source)
        onSource(source)
      }
    } catch {
      // A secondary public page is optional; retain the successful sources.
    }
  }
  return sources.filter((source) => source.excerpt.length > 40)
}
