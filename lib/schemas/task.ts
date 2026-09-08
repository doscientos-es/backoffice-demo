import { z } from 'zod'

import { optionalDate, optionalText, optionalUuid, requiredText } from './common'

/**
 * Zod schemas for the `tasks` domain.
 */

export const TaskStatus = z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled'])
export type TaskStatusType = z.infer<typeof TaskStatus>

export const TaskPriority = z.enum(['low', 'medium', 'high', 'urgent'])
export type TaskPriorityType = z.infer<typeof TaskPriority>

export const CreateTaskInput = z.object({
  title: requiredText(200, 'El título es obligatorio'),
  description: optionalText(8000),
  client_title: optionalText(200),
  client_summary: optionalText(8000),
  project_id: optionalUuid,
  lead_id: optionalUuid,
  client_id: optionalUuid,
  /** Multi-member assignment. First entry becomes the primary assignee_id. */
  member_ids: z.array(z.string().uuid()).optional().default([]),
  status: TaskStatus.default('todo'),
  priority: TaskPriority.default('medium'),
  due_date: optionalDate,
  is_client_visible: z.boolean().optional().default(true),
})

export type CreateTaskInputType = z.infer<typeof CreateTaskInput>

export const UpdateTaskInput = z.object({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  title: requiredText(200, 'El título es obligatorio'),
  description: optionalText(8000),
  client_title: optionalText(200),
  client_summary: optionalText(8000),
  /** Multi-member assignment. First entry becomes the primary assignee_id. */
  member_ids: z.array(z.string().uuid()).optional().default([]),
  status: TaskStatus,
  priority: TaskPriority,
  due_date: optionalDate,
  is_client_visible: z.boolean().optional().default(false),
})

export type UpdateTaskInputType = z.infer<typeof UpdateTaskInput>

export const UpdateTaskStatusInput = z.object({
  taskId: z.string().uuid(),
  status: TaskStatus,
})

export const MoveTaskInput = z.object({
  taskId: z.string().uuid(),
  status: TaskStatus,
  /** Task id immediately above the dropped position (null = top). */
  beforeId: z.string().uuid().nullable().optional(),
  /** Task id immediately below the dropped position (null = bottom). */
  afterId: z.string().uuid().nullable().optional(),
})

export type MoveTaskInputType = z.infer<typeof MoveTaskInput>
