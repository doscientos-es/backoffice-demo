'use server'

// NOTE: Reminders are now stored as tasks with kind='reminder'.
// start_at = remind_at, description = notes. The reminders table is kept for
// legacy data until the migration has run on all environments.

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { CreateReminderInput, ReminderIdInput } from '@/lib/schemas/reminder'
import { createServerClient } from '@/lib/supabase/server'

type ActionResult = { ok: true } | { ok: false; error: string }
type CreateReminderResult = { ok: true; id: string } | { ok: false; error: string }

/**
 * Deletes a reminder — stored as a task with kind='reminder'.
 */
export async function deleteReminder(input: unknown): Promise<ActionResult> {
  await requireUser()
  const parsed = ReminderIdInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('kind', 'reminder')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/inicio')
  revalidatePath('/reminders')
  return { ok: true }
}

/**
 * Creates a reminder stored as a task with kind='reminder'.
 * start_at = remind_at so it appears in the calendar for the assignee.
 */
export async function createReminder(input: unknown): Promise<CreateReminderResult> {
  const user = await requireUser()
  const parsed = CreateReminderInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const { title, actionType, remindAt, notes, leadId, clientId, projectId, assigneeId } =
    parsed.data

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      kind: 'reminder',
      title,
      action_type: actionType,
      description: notes?.trim() || null,
      start_at: new Date(remindAt).toISOString(),
      lead_id: leadId ?? null,
      client_id: clientId ?? null,
      project_id: projectId ?? null,
      created_by: user.id,
      assignee_id: assigneeId ?? user.id,
      status: 'todo',
      priority: 'medium',
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo crear el aviso' }

  revalidatePath('/inicio')
  revalidatePath('/reminders')
  if (leadId) revalidatePath('/leads')
  if (leadId) revalidatePath(`/leads/${leadId}`)
  if (clientId) revalidatePath(`/clients/${clientId}`)
  if (projectId) revalidatePath(`/projects/${projectId}`)
  return { ok: true, id: data.id as string }
}

/**
 * Marks a reminder as completed.
 */
export async function completeReminder(input: unknown): Promise<ActionResult> {
  await requireUser()
  const parsed = ReminderIdInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('tasks')
    .update({ completed_at: new Date().toISOString(), status: 'done' })
    .eq('id', parsed.data.id)
    .eq('kind', 'reminder')
    .is('completed_at', null)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/inicio')
  revalidatePath('/reminders')
  return { ok: true }
}

/**
 * Reopens a previously completed reminder.
 */
export async function uncompleteReminder(input: unknown): Promise<ActionResult> {
  await requireUser()
  const parsed = ReminderIdInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('tasks')
    .update({ completed_at: null, status: 'todo' })
    .eq('id', parsed.data.id)
    .eq('kind', 'reminder')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/inicio')
  revalidatePath('/reminders')
  return { ok: true }
}
