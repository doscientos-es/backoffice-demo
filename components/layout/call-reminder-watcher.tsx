'use client'

import { useEffect } from 'react'

import { notifyDueCallReminders } from '@/app/(app)/leads/actions'

const POLL_INTERVAL_MS = 30_000
const STARTUP_DELAY_MS = 2_000

/**
 * Lightweight in-app scheduler. It needs no cron or paid worker: the browser
 * checks due reminders while the backoffice is open and catches up on focus.
 */
export function CallReminderWatcher() {
  useEffect(() => {
    // It is background housekeeping, not a prerequisite for showing the app.
    // Defer it so the initial RSC and client bundles are not competing with a
    // Server Action. Always consume failures: expired sessions or deployment
    // races otherwise surface as an unhandled Next.js action error.
    const check = () => void notifyDueCallReminders({}).catch(() => undefined)
    const startupTimer = window.setTimeout(check, STARTUP_DELAY_MS)
    const interval = window.setInterval(check, POLL_INTERVAL_MS)
    window.addEventListener('focus', check)
    return () => {
      window.clearTimeout(startupTimer)
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
    }
  }, [])

  return null
}
