import { AlertTriangle, Check, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

const STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info'; icon: typeof Check }
> = {
  email_scheduled: { label: 'Programado', variant: 'info', icon: Check },
  email_sent: { label: 'Enviado', variant: 'success', icon: Check },
  email_delivered: { label: 'Entregado', variant: 'success', icon: Check },
  email_opened: { label: 'Abierto', variant: 'success', icon: Check },
  email_clicked: { label: 'Clic', variant: 'success', icon: Check },
  email_received: { label: 'Recibido', variant: 'success', icon: Check },
  email_delivery_delayed: { label: 'Retrasado', variant: 'warning', icon: AlertTriangle },
  email_bounced: { label: 'Rebotado', variant: 'danger', icon: X },
  email_complained: { label: 'Spam', variant: 'danger', icon: X },
  email_failed: { label: 'Fallido', variant: 'danger', icon: X },
  email_suppressed: { label: 'Suprimido', variant: 'danger', icon: X },
}

export function EmailDeliveryStatuses({ statuses }: { statuses: string[] }) {
  const visible = statuses.flatMap((status) => {
    const meta = STATUS_META[status]
    return meta ? [{ status, ...meta }] : []
  })
  if (visible.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {visible.map(({ status, label, variant, icon: Icon }) => (
        <Badge key={status} variant={variant} className="px-1.5 py-0 text-[10px]">
          <Icon aria-hidden="true" />
          {label}
        </Badge>
      ))}
    </div>
  )
}
