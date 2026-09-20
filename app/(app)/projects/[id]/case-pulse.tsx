import Link from 'next/link'
import { AlertCircle, ArrowRight, Clock3, FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'

export function CasePulse({
  tasks,
  checklist,
  clientRequests,
  updatedAt,
  description,
  status,
}: {
  tasks: Array<{ id: string; title: string; status: string; due_date: string | null }>
  checklist: Array<{ id: string; label: string; is_done: boolean }>
  clientRequests: Array<{ id: string; subject: string; status: string }>
  updatedAt: string | null
  description: string | null
  status: string
}) {
  const pendingDocs = checklist.filter((item) => !item.is_done)
  const openRequests = clientRequests.filter((item) => !['done', 'closed', 'resolved'].includes(item.status))
  const nextTask = tasks.filter((item) => !['done', 'completed', 'cancelled'].includes(item.status)).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))[0]
  const requiresAttention = pendingDocs.length > 0 || openRequests.length > 0

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Resumen operativo</p>
          <p className="mt-1 line-clamp-2 text-lg font-semibold">{description || 'Añade una descripción para que el equipo entienda el contexto en segundos.'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={requiresAttention ? 'warning' : 'success'}>{requiresAttention ? 'Requiere atención' : 'Al día'}</Badge>
            <span className="text-muted-foreground">Estado: {status}</span>
            {updatedAt ? <span className="text-muted-foreground">Actualizado {formatDate(updatedAt)}</span> : null}
          </div>
        </div>
        <PulseStat icon={<FileText className="size-4" />} label="Documentación" value={pendingDocs.length ? `${pendingDocs.length} pendientes` : 'Completa'} href="#checklist" tone={pendingDocs.length ? 'attention' : 'good'} />
        <PulseStat icon={<Clock3 className="size-4" />} label="Siguiente paso" value={nextTask?.title || 'Sin tarea definida'} href={nextTask ? `/tasks/${nextTask.id}` : '#tasks'} tone={nextTask ? 'neutral' : 'attention'} />
        <PulseStat icon={<AlertCircle className="size-4" />} label="Pendiente del cliente" value={openRequests.length ? `${openRequests.length} solicitud${openRequests.length === 1 ? '' : 'es'}` : 'Nada pendiente'} href="#client-requests" tone={openRequests.length ? 'attention' : 'good'} />
      </CardContent>
    </Card>
  )
}

function PulseStat({ icon, label, value, href, tone }: { icon: React.ReactNode; label: string; value: string; href: string; tone: 'good' | 'attention' | 'neutral' }) {
  return <Link href={href} className="group rounded-lg border border-border/70 bg-background/70 p-3 transition-colors hover:border-primary/40 hover:bg-background">
    <div className={cn('flex items-center gap-2 text-xs font-medium', tone === 'good' && 'text-emerald-600 dark:text-emerald-400', tone === 'attention' && 'text-amber-600 dark:text-amber-400', tone === 'neutral' && 'text-muted-foreground')}>{icon}{label}</div>
    <p className="mt-2 line-clamp-2 text-sm font-medium">{value}</p>
    <span className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">Ver detalle <ArrowRight className="size-3" /></span>
  </Link>
}
