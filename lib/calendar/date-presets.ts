import { toDatetimeLocalValue } from '@/lib/utils/date-time'

export const MEETING_DURATIONS = [15, 30, 60, 120] as const
export type MeetingDuration = (typeof MEETING_DURATIONS)[number]
export const DEFAULT_MEETING_DURATION = 60 satisfies MeetingDuration

export function defaultMeetingStart(now: Date = new Date()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + 1)
  date.setHours(10, 0, 0, 0)
  return toDatetimeLocalValue(date)
}
