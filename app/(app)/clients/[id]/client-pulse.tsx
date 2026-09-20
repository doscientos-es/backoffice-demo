import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, Clock3, ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function ClientPulse({
  projects,
  tasks,
  invoices,
}: {
  projects: Array<{ id: string; name: string; status: string }>
  tasks: Array<{ id: string; title: string; status: string }>
  invoices: Array<{ id: string; full_number: string; status: string; total: number | string | null }>
}) {
  const openProjects = projects.filter((p) => !['completed', 'cancelled', 'archived'].includes(p.status))
  const openTasks = tasks.filter((t) => !['done', 'completed', 'cancelled'].includes(t.status))
  const pendingInvoices = invoices.filter((i) => ['issued', 'overdue', 'pending'].includes(i.status))
  const attention = openTasks.length > 0 || pendingInvoices.length > 0

  return <Card className="border-primary/20 bg-primary/[0.03]">
    <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
      <PulseLink href="#projects" icon={<BriefcaseBusiness className="size-4" />} label="Asuntos abiertos" value={`${openProjects.length}`} tone="neutral" />
      <PulseLink href="#tasks" icon={<Clock3 className="size-4" />} label="Tareas pendientes" value={openTasks.length ? `${openTasks.length}` : 'Al día'} tone={openTasks.length ? 'attention' : 'good'} />
      <PulseLink href="#invoices" icon={<ReceiptText className="size-4" />} label="Facturas pendientes" value={pendingInvoices.length ? `${pendingInvoices.length}` : 'Al día'} tone={pendingInvoices.length ? 'attention' : 'good'} />
    </CardContent>
    {attention ? <div className="border-border border-t px-4 py-2 text-xs text-muted-foreground">Hay elementos que requieren seguimiento en esta ficha.</div> : null}
  </Card>
}

function PulseLink({ href, icon, label, value, tone }: { href: string; icon: React.ReactNode; label: string; value: string; tone: 'good' | 'attention' | 'neutral' }) {
  return <Link href={href} className="group rounded-lg border border-border/70 bg-background/70 p-3 hover:border-primary/40 hover:bg-background">
    <div className={cn('flex items-center gap-2 text-xs font-medium', tone === 'good' && 'text-emerald-600 dark:text-emerald-400', tone === 'attention' && 'text-amber-600 dark:text-amber-400', tone === 'neutral' && 'text-muted-foreground')}>{icon}{label}</div>
    <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100">Ver detalle <ArrowRight className="size-3" /></span>
  </Link>
}
