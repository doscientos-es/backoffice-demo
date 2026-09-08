// Minimal service worker — satisfies PWA installability requirements.
// No aggressive caching: backoffice data must always be fresh.
const CACHE_NAME = 'doscientos-bo-v2'

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {}
  event.waitUntil(
    (async () => {
      if ('setAppBadge' in self.navigator && typeof payload.badge === 'number') {
        await self.navigator.setAppBadge(payload.badge)
      }
      await self.registration.showNotification(payload.title || 'Doscientos', {
        body: payload.body || 'Nueva actividad',
        icon: '/brand/logo.png',
        badge: '/brand/logo.png',
        tag: payload.tag || 'doscientos-notification',
        renotify: true,
        requireInteraction: true,
        vibrate: [250, 100, 250],
        actions: Array.isArray(payload.actions) ? payload.actions : [],
        data: { url: payload.url || '/', ...(payload.data || {}) },
      })
    })(),
  )
})

async function openOrFocus(target) {
  if (target.startsWith('tel:')) return self.clients.openWindow(target)
  const targetUrl = new URL(target, self.location.origin)
  if (targetUrl.origin !== self.location.origin) return self.clients.openWindow(targetUrl.href)

  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
  if (existing) {
    await existing.focus()
    await existing.navigate(targetUrl.href)
    return
  }
  await self.clients.openWindow(targetUrl.href)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const target =
    event.action === 'call'
      ? data.callUrl || data.url || '/'
      : event.action === 'feedback'
        ? data.feedbackUrl || data.url || '/'
        : event.action === 'whatsapp'
          ? data.whatsappUrl || data.url || '/'
          : data.url || '/'
  event.waitUntil(
    (async () => {
      try {
        await openOrFocus(target)
      } catch {
        if (data.feedbackUrl) await openOrFocus(data.feedbackUrl)
      }
    })(),
  )
})

// Only pre-cache the app shell assets listed by Next.js
self.addEventListener('install', (_event) => {
  // Skip waiting so the SW activates immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Claim all clients so the SW controls existing tabs
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

// Network-first strategy: always try the network; fall back to cache for
// static assets only. API/auth routes are never cached.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept non-GET requests or cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }

  // Never cache auth or API routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // For everything else: network-first, cache static assets as fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache only successful responses for static assets (_next/static)
        if (response.ok && url.pathname.startsWith('/_next/static/')) {
          const clone = response.clone()
          // Keep cache writes alive after responding, without holding up a
          // route, RSC payload or any CRM data request.
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => undefined),
          )
        }
        return response
      })
      .catch(() => caches.match(request)),
  )
})
