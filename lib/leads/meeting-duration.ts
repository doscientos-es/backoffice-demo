import { todayIsoLocal } from '@/lib/utils/date'

const MAX_CALL_DURATION_MINUTES = 600

type MeetingInteraction = {
  type: string
  payload: unknown
}

/**
 * Suggest the scheduled duration for a call recorded on the day of its meeting.
 * Invalid, future, or out-of-range calendar slots deliberately yield no prefill.
 */
export function suggestedCallDurationMinutes(
  interactions: MeetingInteraction[],
  now: Date = new Date(),
): number | null {
  const today = todayIsoLocal(now)
  const slots = interactions.flatMap((interaction) => {
    if (interaction.type !== 'meeting') return []
    const payload = asRecord(interaction.payload)
    const start = dateFromPayload(payload?.start)
    const end = dateFromPayload(payload?.end)
    if (!start || !end || todayIsoLocal(start) !== today || start > now) return []

    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
    if (minutes <= 0 || minutes > MAX_CALL_DURATION_MINUTES) return []
    return [{ start, minutes }]
  })

  slots.sort((a, b) => b.start.getTime() - a.start.getTime())
  return slots[0]?.minutes ?? null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function dateFromPayload(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
