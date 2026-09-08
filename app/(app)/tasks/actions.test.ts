import { beforeEach, describe, expect, it, vi } from 'vitest'

const { eq, from, syncTaskStatusToGitHub, update } = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  syncTaskStatusToGitHub: vi.fn(),
  update: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireUser: async () => ({ id: 'user-1', email: 'member@example.test', role: 'member' }),
}))
vi.mock('@/lib/integrations/github-sync', () => ({
  autoSyncTaskIssue: vi.fn(),
  syncTaskStatusToGitHub,
}))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('@/lib/notifications/dispatch', () => ({ dispatchNotifications: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ from }),
}))

import { moveTask, updateTaskStatus } from './actions'

const TASK_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  eq.mockReset().mockResolvedValue({ error: null })
  update.mockReset().mockReturnValue({ eq })
  from.mockReset().mockReturnValue({ update })
  syncTaskStatusToGitHub.mockReset()
})

describe('task completion', () => {
  it('completes a task without creating an automatic lead follow-up', async () => {
    const result = await updateTaskStatus({ taskId: TASK_ID, status: 'done' })

    expect(result).toEqual({ ok: true })
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('tasks')
    expect(update).toHaveBeenCalledWith({ status: 'done', completed_at: expect.any(String) })
  })

  it('moves a task to done without creating an automatic lead follow-up', async () => {
    const result = await moveTask({ taskId: TASK_ID, status: 'done' })

    expect(result).toMatchObject({ ok: true })
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('tasks')
  })
})
