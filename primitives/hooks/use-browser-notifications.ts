'use client'

import { useCallback, useEffect, useState } from 'react'

export type BrowserNotifPermission = 'default' | 'granted' | 'denied'

export type BrowserNotifPayload = {
  title: string
  body?: string
  icon?: string
  tag?: string
  /** Relative or absolute URL to navigate to when the notification is clicked. */
  url?: string
}

/**
 * Thin wrapper around the Web Notifications API.
 *
 * - `permission` is kept in sync with the browser state (syncs on tab focus).
 * - `requestPermission()` opens the browser prompt and updates state.
 * - `notify()` fires a native OS notification; no-ops when permission is not granted.
 */
export function useBrowserNotifications() {
  const supported = typeof window !== 'undefined' && 'Notification' in window

  const [permission, setPermission] = useState<BrowserNotifPermission>(() =>
    supported ? (Notification.permission as BrowserNotifPermission) : 'denied',
  )

  useEffect(() => {
    if (!supported) return
    const sync = () => setPermission(Notification.permission as BrowserNotifPermission)
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [supported])

  const requestPermission = useCallback(async (): Promise<BrowserNotifPermission> => {
    if (!supported) return 'denied'
    const result = await Notification.requestPermission()
    setPermission(result as BrowserNotifPermission)
    return result as BrowserNotifPermission
  }, [supported])

  const notify = useCallback(
    ({ title, body, icon, tag, url }: BrowserNotifPayload) => {
      if (!supported || Notification.permission !== 'granted') return
      try {
        const n = new Notification(title, { body, icon, tag })
        n.onclick = () => {
          window.focus()
          n.close()
          if (url) {
            // Use window.location for relative paths; absolute URLs work too.
            const href = url.startsWith('http') ? url : window.location.origin + url
            window.open(href, '_self')
          }
        }
      } catch {
        // Some contexts (iframes, incognito with policy) may throw — ignore.
      }
    },
    [supported],
  )

  return { supported, permission, requestPermission, notify }
}
