import type { CallOutcome } from '@/lib/schemas/lead'

export const CALL_REMINDER_DESCRIPTION = 'CALL_PENDING'
export const CALL_REMINDER_NOTIFIED_DESCRIPTION = 'CALL_PENDING_NOTIFIED'
export const CALL_AUTO_FOLLOW_UP = 'CALL_AUTO_FOLLOW_UP'
export const CALL_REMINDER_DELAY_MS = 3 * 60 * 1000

export function followUpDelayHours(outcome: CallOutcome | undefined): number | null {
  if (outcome === 'busy') return 4
  if (outcome === 'no_answer' || outcome === 'voicemail') return 24
  return null
}

export function normalizePhoneForCall(phone: string): string {
  return phone.replace(/[^\d+#*]/g, '')
}

export function normalizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/\D/g, '')
}
