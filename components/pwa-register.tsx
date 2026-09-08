'use client'

import { useEffect } from 'react'

import { STARTUP_SPLASH_SESSION_KEY } from '@/lib/startup-splash'

/** Registers the PWA service worker after the page loads. */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => undefined)
    }

    try {
      window.sessionStorage.setItem(STARTUP_SPLASH_SESSION_KEY, '1')
    } catch {
      /* The splash still hides when sessionStorage is unavailable. */
    }

    // Do not keep the interface blocked after hydration. The inline fallback in
    // the root layout covers failed or exceptionally slow client bootstraps.
    document.getElementById('startup-splash')?.classList.add('is-hidden')
  }, [])

  return null
}
