import { toDatetimeLocalValue } from '@/lib/utils/date-time'

export function defaultReminderDateTime(now: Date = new Date()): string {
  const date = new Date(now)
  date.setHours(date.getHours() + 1, 0, 0, 0)
  return toDatetimeLocalValue(date)
}

export function defaultFollowUpDateTime(now: Date = new Date()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return toDatetimeLocalValue(date)
}

export function suggestedReminderDateTime(value: string | null, now: Date = new Date()): string {
  if (!value) return defaultReminderDateTime(now)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? defaultReminderDateTime(now) : toDatetimeLocalValue(date)
}
