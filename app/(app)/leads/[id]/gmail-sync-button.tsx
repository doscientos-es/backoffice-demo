'use client'

import { LoaderCircle as Loader2, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import { syncLeadGmail } from '../actions'

export function GmailSyncButton({
  leadId,
  leadEmail,
}: {
  leadId: string
  leadEmail: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const result = await syncLeadGmail({ leadId })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      const suffix = result.unavailableMailboxes.length
        ? ` · ${result.unavailableMailboxes.length} buzón(es) no disponible(s)`
        : ''
      sileo.success({ title: `${result.imported} emails añadidos al historial${suffix}` })
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2"
      disabled={pending || !leadEmail}
      title={leadEmail ? 'Importar emails de Gmail' : 'Este lead no tiene email registrado'}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      {pending ? 'Sincronizando Gmail…' : 'Sincronizar Gmail'}
    </Button>
  )
}
