'use client'

import { useCallback, useEffect, useState } from 'react'

function decodeKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export function useWebPush() {
  const supported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  const [subscribed, setSubscribed] = useState(false)
  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
  }, [supported])
  const subscribe = useCallback(async () => {
    if (!supported || !('Notification' in window) || Notification.permission !== 'granted')
      return false
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      const response = await fetch('/api/push/public-key', { cache: 'no-store' })
      const { publicKey } = (await response.json()) as { publicKey: string }
      if (!publicKey) return false
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      })
    }
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })
    setSubscribed(response.ok)
    return response.ok
  }, [supported])
  return { supported, subscribed, subscribe }
}
