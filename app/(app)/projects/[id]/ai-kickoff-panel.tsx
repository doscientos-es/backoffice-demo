'use client'

import {
  Check,
  Clipboard as ClipboardCheck,
  LoaderCircle as Loader2,
  Sparkle as Sparkles,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { createTask } from '../../tasks/actions'
import { addChecklistItem } from '../checklist-actions'

type Task = { title: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent' }
type Plan = {
  overview: string
  phases: { name: string; objective: string; tasks: Task[] }[]
  checklist: string[]
  kickoff_agenda: string[]
}

export function AiKickoffPanel({ projectId }: { projectId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [selectedChecklist, setSelectedChecklist] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    setApplied(false)
    try {
      const response = await fetch(`/api/projects/${projectId}/generate-kickoff`, {
        method: 'POST',
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'No se pudo preparar el plan.')
      const result = json as Plan
      setPlan(result)
      setSelectedTasks(
        result.phases.flatMap((phase, phaseIndex) =>
          phase.tasks.map((_task, taskIndex) => taskKey(phaseIndex, taskIndex)),
        ),
      )
      setSelectedChecklist(result.checklist)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  async function apply() {
    if (!plan) return
    setApplying(true)
    setError(null)
    try {
      const tasks = plan.phases.flatMap((phase, phaseIndex) =>
        phase.tasks.filter((_task, taskIndex) =>
          selectedTasks.includes(taskKey(phaseIndex, taskIndex)),
        ),
      )
      await Promise.all([
        ...tasks.map((task) =>
          createTask({
            ...task,
            status: 'todo',
            project_id: projectId,
            lead_id: '',
            client_id: '',
            member_ids: [],
            due_date: '',
          }),
        ),
        ...plan.checklist
          .filter((item) => selectedChecklist.includes(item))
          .map((label) => addChecklistItem({ project_id: projectId, label })),
      ])
      setApplied(true)
      setSelectedTasks([])
      setSelectedChecklist([])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo aplicar el plan.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Plan de arranque desde propuesta</p>
          <p className="text-muted-foreground text-xs">
            Convierte el alcance aceptado en tareas y onboarding seleccionables.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          <Sparkles className={cn('size-3.5', loading && 'animate-spin')} />
          {loading ? 'Preparando…' : plan ? 'Regenerar plan' : 'Preparar plan'}
        </Button>
      </div>
      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-3 text-sm">
          <Loader2 className="size-4 animate-spin" /> Leyendo alcance y preparando el arranque…
        </div>
      ) : null}
      {plan ? (
        <div className="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-3 duration-300">
          <p className="bg-muted/50 rounded-md p-2.5 text-sm">{plan.overview}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {plan.phases.map((phase, phaseIndex) => (
              <section key={phase.name} className="bg-background rounded-lg border p-3">
                <p className="text-sm font-medium">{phase.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">{phase.objective}</p>
                <div className="mt-2 space-y-1">
                  {phase.tasks.map((task, taskIndex) => (
                    <SelectRow
                      key={taskKey(phaseIndex, taskIndex)}
                      checked={selectedTasks.includes(taskKey(phaseIndex, taskIndex))}
                      onChange={(checked) =>
                        setSelectedTasks((current) =>
                          checked
                            ? [...current, taskKey(phaseIndex, taskIndex)]
                            : current.filter((key) => key !== taskKey(phaseIndex, taskIndex)),
                        )
                      }
                      label={task.title}
                      detail={task.description}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <section className="bg-muted/20 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <ClipboardCheck className="size-4" /> Checklist de onboarding
            </p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {plan.checklist.map((item) => (
                <SelectRow
                  key={item}
                  checked={selectedChecklist.includes(item)}
                  onChange={(checked) =>
                    setSelectedChecklist((current) =>
                      checked ? [...current, item] : current.filter((value) => value !== item),
                    )
                  }
                  label={item}
                />
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">Agenda sugerida para kickoff</p>
            <ol className="text-muted-foreground mt-2 space-y-1 pl-4 text-xs">
              {plan.kickoff_agenda.map((item) => (
                <li key={item} className="list-decimal">
                  {item}
                </li>
              ))}
            </ol>
          </section>
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              Se crearán {selectedTasks.length} tareas y {selectedChecklist.length} elementos. Nada
              se aplica sin este paso.
            </p>
            <Button
              size="sm"
              onClick={apply}
              disabled={
                applying ||
                applied ||
                (selectedTasks.length === 0 && selectedChecklist.length === 0)
              }
            >
              {applied ? <Check className="size-3.5" /> : null}
              {applying ? 'Aplicando…' : applied ? 'Plan aplicado' : 'Aplicar selección'}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  )
}

function taskKey(phase: number, task: number) {
  return `${phase}-${task}`
}
function SelectRow({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  detail?: string
}) {
  const id = `kickoff-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded p-1.5"
    >
      <Checkbox id={id} isSelected={checked} onChange={onChange} />
      <span className="min-w-0">
        <span className="block text-xs">{label}</span>
        {detail ? <span className="text-muted-foreground block text-[11px]">{detail}</span> : null}
      </span>
    </label>
  )
}
