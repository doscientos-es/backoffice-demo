import { z } from 'zod'

import { REMINDER_ACTION_TYPES } from '@/lib/reminders/action-types'

import { uuidIdInput } from './common'

/**
 * Zod schemas for the `reminders` domain.
 *
 * Reminders must be linked to at least one of: lead, client, or project —
 * the refinement enforces that invariant at the schema level so the action
 * code can rely on it.
 */

export const ReminderIdInput = uuidIdInput

export const CreateReminderInput = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200),
  actionType: z.enum(REMINDER_ACTION_TYPES).default('follow_up'),
  remindAt: z
    .string()
    .min(1, 'Indica fecha y hora')
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Fecha no válida' }),
  notes: z.string().trim().max(4000).optional(),
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  /** ID of the team member to assign this reminder to. Defaults to the current user. */
  assigneeId: z.string().uuid().optional(),
})
export type CreateReminderInputType = z.infer<typeof CreateReminderInput>
