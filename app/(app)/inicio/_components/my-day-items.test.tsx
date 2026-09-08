import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { MyTaskRow } from '@/lib/dashboard/types'

import { MyDayTaskItem } from './my-day-items'

const task: MyTaskRow = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Preparar propuesta',
  kind: 'task',
  status: 'todo',
  priority: 'medium',
  due_date: null,
  action_at: null,
  contextLabel: 'Lead de prueba',
  assigneeName: null,
}

describe('MyDayTaskItem', () => {
  it('allows completing the task from its icon button', () => {
    const onCompleteAction = vi.fn()
    render(<MyDayTaskItem task={task} showAssignee={false} onCompleteAction={onCompleteAction} />)

    fireEvent.click(screen.getByRole('button', { name: `Marcar como completada: ${task.title}` }))

    expect(onCompleteAction).toHaveBeenCalledOnce()
    expect(onCompleteAction).toHaveBeenCalledWith(task.id)
  })
})
