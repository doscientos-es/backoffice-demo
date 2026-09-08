'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createServerClient } from '@/lib/supabase/server'

// ── Parse @mentions from comment body ────────────────────────────────────────

function parseMentions(body: string): string[] {
  return [...body.matchAll(/@([\w.-]+)/g)].map((m) => m[1] ?? '').filter(Boolean)
}

async function notifyRecipients({
  actorId,
  recipientIds,
  taskId,
  taskTitle,
  eventType,
  body,
}: {
  actorId: string
  recipientIds: string[]
  taskId: string
  taskTitle: string
  eventType: 'task_comment' | 'task_mention'
  body: string
}) {
  const unique = [...new Set(recipientIds)].filter((r) => r !== actorId)
  if (unique.length === 0) return

  await dispatchNotifications({
    recipientIds: unique,
    actorId,
    eventType,
    entityType: 'task',
    entityId: taskId,
    body: `${taskTitle}: ${body.slice(0, 120)}`,
    link: `/tasks/${taskId}`,
  })
}

// ── Add comment ───────────────────────────────────────────────────────────────

const AddInput = z.object({
  taskId: z.string().uuid(),
  body: z.string().min(1).max(10000),
})

export async function addComment(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser()
  const parsed = AddInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Comentario no válido' }

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: parsed.data.taskId, author_id: user.id, body: parsed.data.body })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  // Build notification recipient list: assignee + creator + mentioned users
  const { data: task } = await supabase
    .from('tasks')
    .select('title, assignee_id, created_by')
    .eq('id', parsed.data.taskId)
    .maybeSingle()

  const candidates: string[] = [
    task?.assignee_id as string | null,
    task?.created_by as string | null,
  ].filter((x): x is string => typeof x === 'string')

  // Resolve @mentions → member ids
  const handles = parseMentions(parsed.data.body)
  if (handles.length > 0) {
    const { data: mentioned } = await supabase
      .from('team_members')
      .select('id, name, email')
      .is('deleted_at', null)
    const memberList = mentioned ?? []
    for (const handle of handles) {
      const lc = handle.toLowerCase()
      const match = memberList.find(
        (m) =>
          (m.name as string).toLowerCase().replace(/\s+/g, '.') === lc ||
          (m.email as string).toLowerCase().split('@')[0] === lc,
      )
      if (match) candidates.push(match.id as string)
    }
  }

  await notifyRecipients({
    actorId: user.id,
    recipientIds: candidates,
    taskId: parsed.data.taskId,
    taskTitle: (task?.title as string | null) ?? 'Tarea',
    eventType: handles.length > 0 ? 'task_mention' : 'task_comment',
    body: parsed.data.body,
  })

  revalidatePath(`/tasks/${parsed.data.taskId}`)
  return { ok: true, id: data.id as string }
}

// ── Delete comment ────────────────────────────────────────────────────────────

export async function deleteComment(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()
  const parsed = z
    .object({ commentId: z.string().uuid(), taskId: z.string().uuid() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  // Members can delete own; admin/owner can delete any
  const { error } = await supabase
    .from('task_comments')
    .delete()
    .eq('id', parsed.data.commentId)
    .or(`author_id.eq.${user.id},and(author_id.neq.${user.id})`)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/tasks/${parsed.data.taskId}`)
  return { ok: true }
}

// ── Mark notifications read ───────────────────────────────────────────────────

export async function markNotificationsRead(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()
  const parsed = z.object({ ids: z.array(z.string().uuid()).optional() }).safeParse(input ?? {})
  if (!parsed.success) return { ok: false, error: 'IDs inválidos' }

  const supabase = await createServerClient()
  let q = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .is('read_at', null)

  if (parsed.data.ids && parsed.data.ids.length > 0) {
    q = q.in('id', parsed.data.ids)
  }

  const { error } = await q
  if (error) return { ok: false, error: error.message }

  return { ok: true }
}
