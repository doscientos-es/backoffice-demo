'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { requireUser } from '@/lib/auth'
import { VersionConflictError } from '@/lib/concurrency/version-conflict'
import { autoSyncTaskIssue, syncTaskStatusToGitHub } from '@/lib/integrations/github-sync'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import {
  CreateTaskInput,
  MoveTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from '@/lib/schemas/task'
import { createServerClient } from '@/lib/supabase/server'
import { normalizeTaskMemberIds } from '@/lib/tasks/assignments'
import { rankAfter, rankBetween } from '@/lib/utils/ranking'

export const createTask = defineAction<
  typeof CreateTaskInput,
  { id: string; projectId: string | null }
>({
  name: 'tasks.create',
  schema: CreateTaskInput,
  revalidate: (_payload, input) => [
    '/tasks',
    ...(input.project_id ? [`/projects/${input.project_id}`] : []),
    ...(input.lead_id ? [`/leads/${input.lead_id}`] : []),
    ...(input.client_id ? [`/clients/${input.client_id}`] : []),
  ],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()

    const { member_ids = [], ...taskData } = input
    // The creator is the primary assignee by default. Selecting any members
    // explicitly lets the creator replace that primary assignment.
    const assignedMemberIds = normalizeTaskMemberIds(user.id, member_ids)
    const assigneeId = assignedMemberIds[0] ?? null

    // Compute kanban_order = rankAfter(max existing for same project+status).
    let kanbanOrder = 'm'
    if (taskData.project_id) {
      const { data: last } = await supabase
        .from('tasks')
        .select('kanban_order')
        .eq('project_id', taskData.project_id)
        .eq('status', taskData.status)
        .is('deleted_at', null)
        .order('kanban_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      kanbanOrder = rankAfter((last?.kanban_order as string | null) ?? null)
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        assignee_id: assigneeId,
        kanban_order: kanbanOrder,
        created_by: user.id,
      })
      .select('id, project_id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear la tarea')

    // Sync task_members
    if (assignedMemberIds.length > 0) {
      const { error: membersError } = await supabase
        .from('task_members')
        .insert(assignedMemberIds.map((mid) => ({ task_id: data.id as string, member_id: mid })))
      if (membersError) throw new Error(membersError.message)
    }

    await dispatchNotifications({
      recipientIds: assignedMemberIds,
      actorId: user.id,
      eventType: 'task_assigned',
      entityType: 'task',
      entityId: data.id as string,
      body: `Te han asignado la tarea “${taskData.title}”`,
      link: `/tasks/${data.id}`,
    })

    // Fire-and-forget GitHub sync
    if (data.project_id) {
      void autoSyncTaskIssue(data.id as string, data.project_id as string)
    }

    return { id: data.id as string, projectId: (data.project_id as string | null) ?? null }
  },
})

export const updateTask = defineAction({
  name: 'tasks.update',
  schema: UpdateTaskInput,
  revalidate: (_payload, input) => ['/tasks', `/tasks/${input.id}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()

    const { id, expected_version, member_ids = [], ...rest } = input
    const assigneeId = member_ids[0] ?? null

    const { data: previousMembers } = await supabase
      .from('task_members')
      .select('member_id')
      .eq('task_id', id)
    const previousMemberIds = new Set(
      (previousMembers ?? []).map((member) => member.member_id as string),
    )

    const updates: Record<string, unknown> = {
      title: rest.title,
      description: rest.description ?? null,
      assignee_id: assigneeId,
      status: rest.status,
      priority: rest.priority,
      due_date: rest.due_date ?? null,
      is_client_visible: rest.is_client_visible,
    }
    if (rest.status === 'done') updates.completed_at = new Date().toISOString()
    if (rest.status === 'in_progress') updates.started_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('version', expected_version)
      .select('version')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new VersionConflictError()
    // Sync task_members: replace all existing entries
    const { error: deleteMembersError } = await supabase
      .from('task_members')
      .delete()
      .eq('task_id', id)
    if (deleteMembersError) throw new Error(deleteMembersError.message)
    if (member_ids.length > 0) {
      const { error: insertMembersError } = await supabase
        .from('task_members')
        .insert(member_ids.map((mid) => ({ task_id: id, member_id: mid })))
      if (insertMembersError) throw new Error(insertMembersError.message)
    }

    const newlyAssignedMemberIds = member_ids.filter((memberId) => !previousMemberIds.has(memberId))
    await dispatchNotifications({
      recipientIds: newlyAssignedMemberIds,
      actorId: user.id,
      eventType: 'task_assigned',
      entityType: 'task',
      entityId: id,
      body: `Te han asignado la tarea “${rest.title}”`,
      link: `/tasks/${id}`,
    })

    void syncTaskStatusToGitHub(id, rest.status)
    return { version: Number(data.version) }
  },
})

export const updateTaskStatus = defineAction({
  name: 'tasks.updateStatus',
  schema: UpdateTaskStatusInput,
  revalidate: (_payload, input) => ['/tasks', `/tasks/${input.taskId}`],
  handler: async (data) => {
    const supabase = await createServerClient()
    const updates: Record<string, unknown> = { status: data.status }
    if (data.status === 'done') updates.completed_at = new Date().toISOString()
    if (data.status === 'in_progress') updates.started_at = new Date().toISOString()

    const { error } = await supabase.from('tasks').update(updates).eq('id', data.taskId)
    if (error) throw new Error(error.message)
    void syncTaskStatusToGitHub(data.taskId, data.status)
  },
})

// ---------------- MOVE TASK (Kanban reorder) ----------------

export async function moveTask(
  input: unknown,
): Promise<{ ok: true; kanbanOrder: string } | { ok: false; error: string }> {
  await requireUser()
  const parsed = MoveTaskInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Movimiento no válido' }

  const supabase = await createServerClient()

  const ids = [parsed.data.beforeId, parsed.data.afterId].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
  let beforeOrder: string | null = null
  let afterOrder: string | null = null
  if (ids.length > 0) {
    const { data: neighbors } = await supabase
      .from('tasks')
      .select('id, kanban_order')
      .in('id', ids)
    for (const n of neighbors ?? []) {
      if (n.id === parsed.data.beforeId) beforeOrder = n.kanban_order as string
      if (n.id === parsed.data.afterId) afterOrder = n.kanban_order as string
    }
  }

  let kanbanOrder: string
  try {
    kanbanOrder = rankBetween(beforeOrder, afterOrder)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Orden inválido' }
  }

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    kanban_order: kanbanOrder,
  }
  if (parsed.data.status === 'done') updates.completed_at = new Date().toISOString()
  if (parsed.data.status === 'in_progress') updates.started_at = new Date().toISOString()

  const { error } = await supabase.from('tasks').update(updates).eq('id', parsed.data.taskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${parsed.data.taskId}`)
  return { ok: true, kanbanOrder }
}

// ---------------- GITHUB MANUAL SYNC ----------------

/**
 * Manually request GitHub issue creation for a task. Safe to call from a form
 * — internally uses the same helper as the post-insert auto-sync, so it
 * respects `github_sync_mode` and existing `github_issue_number`.
 */
export async function syncTaskToGithub(formData: FormData): Promise<void> {
  await requireUser()
  const taskId = formData.get('taskId')?.toString() ?? ''
  if (!z.string().uuid().safeParse(taskId).success) throw new Error('ID inválido')

  const supabase = await createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', taskId)
    .maybeSingle()
  if (!task?.project_id) throw new Error('La tarea no tiene proyecto asociado')

  await autoSyncTaskIssue(taskId, task.project_id as string)
  revalidatePath(`/tasks/${taskId}`)
}

// ---------------- SOFT DELETE ----------------

export async function deleteTask(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const parsed = z.object({ taskId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.taskId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tasks')
  return { ok: true }
}

/**
 * Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
 * shown after `deleteTask`. Mirrors `deleteTask`'s `{ taskId }` signature.
 */
export async function restoreTask(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const parsed = z.object({ taskId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: null })
    .eq('id', parsed.data.taskId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/tasks')
  return { ok: true }
}
