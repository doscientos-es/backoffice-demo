const HREF_RE = /href=(["'])(https?:\/\/[^"']+)\1/gi

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function trackingBase(appUrl: string): string {
  return appUrl.replace(/\/+$/, '')
}

export function appendOpenPixel(html: string, appUrl: string, token: string): string {
  const src = `${trackingBase(appUrl)}/api/track/open/${token}`
  const pixel = `<img src="${src}" width="1" height="1" alt="" style="display:none!important;opacity:0;width:1px;height:1px" />`
  return `${html}\n${pixel}`
}

export function wrapTrackedLinks(html: string, appUrl: string, token: string): string {
  const base = trackingBase(appUrl)
  return html.replace(HREF_RE, (match, quote: string, rawUrl: string) => {
    const destination = safeUrl(rawUrl)
    if (!destination) return match
    const tracked = `${base}/api/track/click/${token}?url=${encodeURIComponent(destination)}`
    return `href=${quote}${tracked}${quote}`
  })
}

export function addEmailTracking(html: string, appUrl: string, token: string): string {
  return appendOpenPixel(wrapTrackedLinks(html, appUrl, token), appUrl, token)
}
