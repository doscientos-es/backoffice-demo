'use client'

import { Download, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'doscientos:pwa-install-dismissed'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

/** Offers app installation only when the browser has made it available. */
export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [standalone, setStandalone] = useState(true)
  const [ios, setIos] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setStandalone(isStandalone())
    setIos(isIos())
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1')

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (standalone || dismissed || (!installEvent && !ios)) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  async function install() {
    if (!installEvent) return
    setPending(true)
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      if (choice.outcome === 'accepted') setStandalone(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md sm:right-4 sm:left-auto sm:mx-0">
      <Alert className="shadow-lg">
        {ios ? <Share2 /> : <Download />}
        <AlertTitle>{ios ? 'Añade Doscientos a tu inicio' : 'Instala Doscientos'}</AlertTitle>
        <AlertDescription>
          {ios
            ? 'En Safari, pulsa Compartir y elige «Añadir a pantalla de inicio» para abrirlo como una app.'
            : 'Ábrelo más rápido y usa los accesos directos para leads, tareas y agenda.'}
        </AlertDescription>
        <AlertAction className="flex items-center gap-1">
          {!ios ? (
            <Button type="button" size="xs" disabled={pending} onClick={() => void install()}>
              {pending ? 'Abriendo…' : 'Instalar'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={dismiss}
            aria-label="Descartar aviso de instalación"
          >
            <X className="size-3.5" />
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
