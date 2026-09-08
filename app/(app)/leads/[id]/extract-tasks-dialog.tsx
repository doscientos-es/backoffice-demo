'use client'

import { CircleAlert as AlertCircle, CheckCheck, ListTodo, Sparkle as Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sileo } from 'sileo'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type SuggestedTask = {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

const PRIORITY_LABEL: Record<SuggestedTask['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

const PRIORITY_VARIANT: Record<
  SuggestedTask['priority'],
  'neutral' | 'info' | 'warning' | 'danger'
> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

type CreateTaskFn = (input: {
  title: string
  description?: string
  lead_id: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo'
}) => Promise<{ ok: true; id: string; projectId: string | null } | { ok: false; error: string }>

export type ExtractTasksDialogProps = {
  leadId: string
  trigger?: React.ReactNode
  createTaskAction: CreateTaskFn
}

export function ExtractTasksDialog({ leadId, trigger, createTaskAction }: ExtractTasksDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<SuggestedTask[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setTasks([])
    setSelected(new Set())

    fetch('/api/crm/ai/extract-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error ?? 'Error al extraer tareas.')
        const all = json.tasks as SuggestedTask[]
        setTasks(all)
        setSelected(new Set(all.map((_, i) => i)))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error desconocido'))
      .finally(() => setLoading(false))
  }, [open, leadId])

  function toggleTask(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  async function handleCreate() {
    const toCreate = tasks.filter((_, i) => selected.has(i))
    if (toCreate.length === 0) return
    setCreating(true)
    let created = 0
    for (const t of toCreate) {
      const res = await createTaskAction({
        title: t.title,
        description: t.description || undefined,
        lead_id: leadId,
        priority: t.priority,
        status: 'todo',
      })
      if (res.ok) created++
    }
    setCreating(false)
    sileo.success({
      title: `${created} tarea${created !== 1 ? 's' : ''} creada${created !== 1 ? 's' : ''}`,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="w-full justify-start gap-2">
            <ListTodo className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">Extraer tareas IA</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Tareas sugeridas por IA
          </DialogTitle>
          <DialogDescription>
            Selecciona las tareas que quieres crear para este lead.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {loading && (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-destructive flex items-center gap-1.5 text-xs">
              <AlertCircle className="size-3.5 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && tasks.length > 0 && (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
              {tasks.map((task, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: task list is replaced wholesale, never reordered in place
                  key={`${task.title}-${i}`}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                    selected.has(i)
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-muted/20',
                  )}
                  onClick={() => toggleTask(i)}
                >
                  <Checkbox
                    isSelected={selected.has(i)}
                    onChange={() => toggleTask(i)}
                    className="mt-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={PRIORITY_VARIANT[task.priority]} className="shrink-0 text-[10px]">
                    {PRIORITY_LABEL[task.priority]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {!loading && !error && tasks.length === 0 && (
            <p className="bg-muted/40 text-muted-foreground rounded-md p-3 text-sm">
              No hay acciones concretas que crear con la información actual. Añade una nota,
              registra la llamada o programa el siguiente paso cuando lo tengas claro.
            </p>
          )}
        </div>

        {!loading && tasks.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <span className="text-muted-foreground text-xs">
              {selected.size} de {tasks.length} seleccionadas
            </span>
            <Button onClick={handleCreate} disabled={selected.size === 0 || creating} size="sm">
              <CheckCheck className="size-3.5" />
              {creating
                ? 'Creando…'
                : `Crear ${selected.size > 0 ? selected.size : ''} tarea${selected.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
