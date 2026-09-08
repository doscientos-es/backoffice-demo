'use client'

import { Select } from '@/components/ui/select'
import { useOptimisticUpdate } from '@/lib/hooks/use-optimistic-update'
import type { TaskStatusType } from '@/lib/schemas/task'

import { updateTaskStatus } from '../actions'

const OPTIONS: { value: TaskStatusType; label: string }[] = [
  { value: 'todo', label: 'Por hacer' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'in_review', label: 'Revisión' },
  { value: 'done', label: 'Terminada' },
  { value: 'cancelled', label: 'Cancelada' },
]

export function TaskStatusSelect({ taskId, status }: { taskId: string; status: string }) {
  const { value, commit } = useOptimisticUpdate<TaskStatusType>(status as TaskStatusType)

  return (
    <Select
      value={value}
      className="h-8 w-36"
      onChange={(e) => {
        const next = e.target.value as TaskStatusType
        commit(next, () => updateTaskStatus({ taskId, status: next }))
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  )
}
