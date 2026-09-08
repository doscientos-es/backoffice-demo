import { describe, expect, it } from 'vitest'

import {
  collectDailyResponsibilities,
  formatDailyResponsibilityBody,
} from './daily-responsibilities'

describe('daily responsibility summaries', () => {
  it('counts due work for every responsible member without duplicating a task', () => {
    const summaries = collectDailyResponsibilities({
      today: '2026-08-13',
      tasks: [
        { assigneeId: 'member-a', memberIds: ['member-a', 'member-b'], dueAt: '2026-08-12' },
        { assigneeId: 'member-a', memberIds: [], dueAt: '2026-08-13' },
      ],
      reminders: [{ assigneeId: 'member-b', memberIds: [], dueAt: '2026-08-13T07:00:00.000Z' }],
      staleLeads: [{ assignedTo: 'member-b' }],
    })

    expect(summaries).toEqual([
      {
        recipientId: 'member-a',
        overdueTasks: 1,
        tasksDueToday: 1,
        pendingReminders: 0,
        staleLeads: 0,
      },
      {
        recipientId: 'member-b',
        overdueTasks: 1,
        tasksDueToday: 0,
        pendingReminders: 1,
        staleLeads: 1,
      },
    ])
  })

  it('prioritizes overdue work in a concise morning summary', () => {
    expect(
      formatDailyResponsibilityBody({
        recipientId: 'member-a',
        overdueTasks: 2,
        tasksDueToday: 1,
        pendingReminders: 0,
        staleLeads: 3,
      }),
    ).toBe(
      'Buenos días. Prioridad: tienes 2 tareas vencidas, 1 tarea para hoy y 3 leads por responder.',
    )
  })

  it('uses a neutral greeting when there is no overdue work', () => {
    expect(
      formatDailyResponsibilityBody({
        recipientId: 'member-a',
        overdueTasks: 0,
        tasksDueToday: 1,
        pendingReminders: 0,
        staleLeads: 2,
      }),
    ).toBe('Buenos días. Tienes 1 tarea para hoy y 2 leads por responder.')
  })
})
