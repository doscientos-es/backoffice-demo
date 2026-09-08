'use client'

import { completeReminder } from '@/app/(app)/reminders/actions'
import { Badge } from '@/components/ui/badge'
import type { ReminderRow } from '@/lib/dashboard/types'
import { useOptimisticRemoval } from '@/lib/hooks/use-optimistic-removal'
import { relativeTime } from '@/lib/utils'

import { ReminderCompleteButton } from './reminder-complete-button'

/**
 * Client island: renders the reminders list with optimistic completion.
 * Clicking the check mark removes the row instantly; reverts with a toast if
 * the server action fails.
 */
export function RemindersSection({ reminders }: { reminders: ReminderRow[] }) {
  const { items, remove } = useOptimisticRemoval(reminders)

  return (
    <ul className="space-y-1.5">
      {items.map((r) => {
        const overdue = new Date(r.remind_at) < new Date()
        return (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-sm">{r.title}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge variant={overdue ? 'danger' : 'info'}>{relativeTime(r.remind_at)}</Badge>
              <ReminderCompleteButton
                id={r.id}
                onCompleteAction={(id) => remove(id, () => completeReminder({ id }))}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
