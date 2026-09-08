import {
  TriangleAlert as AlertTriangle,
  BellRing,
  FileText as FileWarning,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import type {
  AvisosData,
  OverdueInvoiceRow,
  ReminderRow,
  VerifactuPendingRow,
} from '@/lib/dashboard/types'
import { VERIFACTU_ALERT_STATUS } from '@/lib/status'
import { formatDate, formatEUR, relativeTime } from '@/lib/utils'

export type { AvisosData, OverdueInvoiceRow, ReminderRow, VerifactuPendingRow }

export type AvisosPanelProps = AvisosData & { showFinance?: boolean }

export function AvisosPanel({
  verifactuPending,
  overdueInvoices,
  certExpiresAt,
  showFinance = true,
}: AvisosPanelProps) {
  const visibleVerifactu = showFinance ? verifactuPending : []
  const visibleOverdue = showFinance ? overdueInvoices : []
  const visibleCertExpiry = showFinance ? certExpiresAt : null

  const empty = visibleVerifactu.length === 0 && visibleOverdue.length === 0 && !visibleCertExpiry

  if (empty) {
    return (
      <Card className="border-border/80 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-4" /> Avisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg bg-emerald-500/8 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            Sin avisos pendientes. Todo en orden.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="via-card to-card border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4" /> Avisos
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-border/70 flex flex-col divide-y [&>div]:py-3 first:[&>div]:pt-0 last:[&>div]:pb-0">
        {visibleCertExpiry ? (
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">Certificado Verifactu por caducar</p>
              <p className="text-muted-foreground text-xs">
                Caduca el {formatDate(visibleCertExpiry)} ({relativeTime(visibleCertExpiry)}).{' '}
                <Link href="/settings" className="underline">
                  Renovar
                </Link>
                .
              </p>
            </div>
          </div>
        ) : null}

        {visibleVerifactu.length > 0 ? (
          <Section
            icon={<AlertTriangle className="size-4 text-amber-500" />}
            title={`Verifactu pendiente (${visibleVerifactu.length})`}
          >
            <ul className="space-y-1.5">
              {visibleVerifactu.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <Link href={`/invoices/${v.id}`} className="truncate text-sm hover:underline">
                    {v.full_number ?? v.id.slice(0, 8)}
                    {v.client_name ? (
                      <span className="text-muted-foreground"> · {v.client_name}</span>
                    ) : null}
                  </Link>
                  <StatusBadge meta={VERIFACTU_ALERT_STATUS} value={v.verifactu_status} />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {visibleOverdue.length > 0 ? (
          <Section
            icon={<FileWarning className="size-4 text-red-500" />}
            title={`Facturas vencidas (${visibleOverdue.length})`}
          >
            <ul className="space-y-1.5">
              {visibleOverdue.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2">
                  <Link href={`/invoices/${inv.id}`} className="truncate text-sm hover:underline">
                    {inv.full_number ?? inv.id.slice(0, 8)}
                    {inv.client_name ? (
                      <span className="text-muted-foreground"> · {inv.client_name}</span>
                    ) : null}
                  </Link>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {formatEUR(inv.total)} · venció{' '}
                    {relativeTime(inv.due_date ?? new Date().toISOString())}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}
