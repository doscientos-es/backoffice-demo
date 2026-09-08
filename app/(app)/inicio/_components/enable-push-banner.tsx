'use client'

import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useBrowserNotifications } from '@/lib/hooks/use-browser-notifications'
import { useWebPush } from '@/lib/hooks/use-web-push'

const DISMISS_KEY = 'doscientos-push-banner-dismissed'

/**
 * Prompts the user to enable push notifications on the current device
 * (desktop or mobile) when they haven't subscribed yet. Dismissible; the
 * choice is remembered in localStorage so it doesn't nag on every visit.
 */
export function EnablePushBanner() {
  const { permission, requestPermission } = useBrowserNotifications()
  const { supported, subscribed, subscribe } = useWebPush()
  const [dismissed, setDismissed] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (!supported || subscribed || permission === 'denied' || dismissed) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function handleEnable() {
    setPending(true)
    try {
      const result = permission === 'default' ? await requestPermission() : permission
      if (result === 'granted') await subscribe()
    } finally {
      setPending(false)
    }
  }

  return (
    <Alert>
      <BellRing />
      <AlertTitle>Activa las notificaciones en este dispositivo</AlertTitle>
      <AlertDescription>
        Recibe avisos de nuevos leads, tareas y pagos también aquí, no solo en el móvil.
      </AlertDescription>
      <AlertAction className="flex items-center gap-1">
        <Button type="button" size="xs" onClick={handleEnable} disabled={pending}>
          {pending ? 'Activando…' : 'Activar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          disabled={pending}
          aria-label="Descartar aviso"
        >
          <X className="size-3.5" />
        </Button>
      </AlertAction>
    </Alert>
  )
}
