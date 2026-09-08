'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import { refreshInvoiceClientSnapshot } from '../actions'

export function RefreshClientSnapshotButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const res = await refreshInvoiceClientSnapshot({ id: invoiceId })
      if (res.ok) {
        sileo.success({ title: 'Datos del cliente actualizados' })
        router.refresh()
      } else {
        sileo.error({ title: res.error })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={pending}
      title="Recargar datos del cliente"
      aria-label="Recargar datos fiscales del cliente"
    >
      <RefreshCw className={pending ? 'animate-spin' : ''} />
    </Button>
  )
}
