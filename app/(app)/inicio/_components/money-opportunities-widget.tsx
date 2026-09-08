import {
  Banknote,
  ChevronRight,
  FilePlus as FilePlus2,
  FileText as FileSignature,
  Flame,
  Undo2 as RotateCcw,
} from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMoneyOpportunities } from '@/lib/dashboard/queries'
import type {
  AcceptedUninvoicedRow,
  MoneyOpportunities,
  MoneyProposalRow,
  PriorityLeadRow,
  RecoverableLeadRow,
} from '@/lib/dashboard/types'
import { formatEUR, relativeTime } from '@/lib/utils'

export async function MoneyOpportunitiesWidget() {
  const data = await getMoneyOpportunities()
  return <MoneyOpportunitiesPanel data={data} />
}

function MoneyOpportunitiesPanel({ data }: { data: MoneyOpportunities }) {
  const empty =
    data.openProposals.length === 0 &&
    data.acceptedUninvoiced.length === 0 &&
    data.priorityLeads.length === 0 &&
    data.recoverableLeads.length === 0

  return (
    <Card className="via-card to-card border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.06] shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Banknote className="size-4" />
          </span>
          <span>
            Dinero accionable
            <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
              Próximos movimientos con impacto
            </span>
          </span>
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link href="/leads/recovery">
            Repesca <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No hay oportunidades urgentes detectadas.
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-4">
            <OpenProposals rows={data.openProposals} total={data.openProposalsTotal} />
            <AcceptedUninvoiced
              rows={data.acceptedUninvoiced}
              total={data.acceptedUninvoicedTotal}
            />
            <PriorityLeads rows={data.priorityLeads} total={data.priorityPipelineTotal} />
            <RecoverableLeads rows={data.recoverableLeads} count={data.recoverableCount} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Section({
  icon,
  title,
  metric,
  href,
  children,
}: {
  icon: React.ReactNode
  title: string
  metric: string
  href: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border/70 bg-background/65 min-w-0 rounded-xl border transition-all hover:border-emerald-500/25 hover:shadow-sm">
      <div className="border-border/60 flex items-start justify-between gap-3 border-b px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            {icon}
            <span className="truncate">{title}</span>
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{metric}</p>
        </div>
        <Link
          href={href}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
          aria-label={`Ver ${title}`}
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="px-3 py-2">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-4 text-sm">{children}</p>
}

function OpenProposals({ rows, total }: { rows: MoneyProposalRow[]; total: number }) {
  return (
    <Section
      icon={<FileSignature className="size-4 text-blue-500" />}
      title="Cerrar propuestas"
      metric={formatEUR(total)}
      href="/proposals"
    >
      {rows.length === 0 ? (
        <Empty>Sin propuestas abiertas.</Empty>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/proposals/${row.id}`} className="block min-w-0 hover:underline">
                <span className="block truncate text-sm font-medium">
                  {row.number ?? 'Sin número'} · {row.title}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {row.client_name ?? row.lead_name ?? 'Sin cliente'} ·{' '}
                  {relativeTime(row.updated_at)}
                </span>
              </Link>
              <div className="mt-1 flex items-center justify-between gap-2">
                <Badge variant={row.status === 'viewed' ? 'warning' : 'info'}>
                  {row.status === 'viewed' ? 'Vista' : 'Enviada'}
                </Badge>
                <span className="text-xs font-medium tabular-nums">{formatEUR(row.total)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function AcceptedUninvoiced({ rows, total }: { rows: AcceptedUninvoicedRow[]; total: number }) {
  return (
    <Section
      icon={<FilePlus2 className="size-4 text-emerald-500" />}
      title="Facturar vendido"
      metric={formatEUR(total)}
      href="/proposals"
    >
      {rows.length === 0 ? (
        <Empty>Todo lo aceptado está facturado.</Empty>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/proposals/${row.id}`} className="block min-w-0 hover:underline">
                <span className="block truncate text-sm font-medium">
                  {row.number ?? 'Sin número'} · {row.title}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {row.client_name ?? 'Sin cliente'} · facturado {formatEUR(row.invoiced_total)}
                </span>
              </Link>
              <p className="mt-1 text-xs font-medium text-emerald-700 tabular-nums dark:text-emerald-300">
                Falta {formatEUR(row.remaining_total)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function PriorityLeads({ rows, total }: { rows: PriorityLeadRow[]; total: number }) {
  return (
    <Section
      icon={<Flame className="size-4 text-amber-500" />}
      title="Leads calientes"
      metric={total > 0 ? formatEUR(total) : `${rows.length} activos`}
      href="/leads?attention=stale"
    >
      {rows.length === 0 ? (
        <Empty>No hay leads activos urgentes.</Empty>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/leads/${row.id}`} className="block min-w-0 hover:underline">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {row.company ?? row.source ?? 'Sin empresa'} · {relativeTime(row.updated_at)}
                </span>
              </Link>
              <div className="mt-1 flex flex-wrap gap-1">
                {row.score != null ? <Badge variant="warning">score {row.score}</Badge> : null}
                {!row.has_next_action ? <Badge variant="danger">sin acción</Badge> : null}
                {row.stale ? <Badge variant="neutral">frío</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function RecoverableLeads({ rows, count }: { rows: RecoverableLeadRow[]; count: number }) {
  return (
    <Section
      icon={<RotateCcw className="size-4 text-violet-500" />}
      title="Repesca"
      metric={`${count} recuperables`}
      href="/leads/recovery"
    >
      {rows.length === 0 ? (
        <Empty>Sin perdidos con señal clara.</Empty>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/leads/${row.id}`} className="block min-w-0 hover:underline">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {row.company ?? row.source ?? 'Sin empresa'} · {relativeTime(row.updated_at)}
                </span>
              </Link>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="info">{row.signal}</Badge>
                {row.lost_reason ? <Badge variant="neutral">{row.lost_reason}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
