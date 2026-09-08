import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { notifyDueCallReminders } = vi.hoisted(() => ({ notifyDueCallReminders: vi.fn() }))

vi.mock('@/app/(app)/leads/actions', () => ({ notifyDueCallReminders }))

import { CallReminderWatcher } from './call-reminder-watcher'

describe('CallReminderWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    notifyDueCallReminders.mockReset().mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('defers the initial Server Action until after startup', async () => {
    render(<CallReminderWatcher />)

    expect(notifyDueCallReminders).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(notifyDueCallReminders).toHaveBeenCalledWith({})
  })

  it('consumes rejected background actions', async () => {
    notifyDueCallReminders.mockRejectedValue(new Error('unexpected response'))
    render(<CallReminderWatcher />)

    await vi.advanceTimersByTimeAsync(2_000)
    await Promise.resolve()
    expect(notifyDueCallReminders).toHaveBeenCalledOnce()
  })
})
