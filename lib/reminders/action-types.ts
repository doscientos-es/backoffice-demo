export const REMINDER_ACTION_TYPES = ['call', 'meeting', 'email', 'follow_up'] as const

export type ReminderActionType = (typeof REMINDER_ACTION_TYPES)[number]

export const REMINDER_ACTION_TYPE_LABEL: Record<ReminderActionType, string> = {
  call: 'Llamada',
  meeting: 'Reunión',
  email: 'Email',
  follow_up: 'Seguimiento',
}
