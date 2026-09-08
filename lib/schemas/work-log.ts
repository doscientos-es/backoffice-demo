import { z } from 'zod'

/** Acepta "HH:MM" o "HH:MM:SS" en formato 24h. */
const TimeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora no válida')

/**
 * Convierte una hora "HH:MM" en minutos desde medianoche.
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * Calcula las horas decimales de un rango inicio→fin (mismo día), redondeadas
 * a 2 decimales para encajar en `work_logs.hours` (numeric(5,2)).
 * Devuelve `null` si el rango no es válido (fin <= inicio o > 24h).
 */
export function computeHoursFromRange(start: string, end: string): number | null {
  const mins = timeToMinutes(end) - timeToMinutes(start)
  if (mins <= 0 || mins > 24 * 60) return null
  return Math.round((mins / 60) * 100) / 100
}

/**
 * New manual work-log entry. `member_id` is never accepted from the client:
 * the action stamps it from the authenticated user. The duration is recorded
 * as a time range (inicio → fin) and `hours` is derived server-side.
 */
export const AddWorkLogInput = z
  .object({
    project_id: z.string().uuid(),
    work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida'),
    start_time: TimeString,
    end_time: TimeString,
    note: z.string().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (computeHoursFromRange(v.start_time, v.end_time) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_time'],
        message: 'La hora de fin debe ser posterior a la de inicio.',
      })
    }
  })
export type AddWorkLogInputType = z.infer<typeof AddWorkLogInput>

/**
 * Edita una entrada existente. Si se envían `start_time` y `end_time`, se
 * recalculan las horas; si no, solo se actualiza la nota. Enviar solo una de
 * las dos horas es inválido.
 */
export const UpdateWorkLogInput = z
  .object({
    id: z.string().uuid(),
    project_id: z.string().uuid(),
    start_time: TimeString.optional(),
    end_time: TimeString.optional(),
    note: z.string().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    const hasStart = !!v.start_time
    const hasEnd = !!v.end_time
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_time'],
        message: 'Indica inicio y fin, o deja ambos vacíos.',
      })
      return
    }
    if (hasStart && hasEnd && computeHoursFromRange(v.start_time!, v.end_time!) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_time'],
        message: 'La hora de fin debe ser posterior a la de inicio.',
      })
    }
  })
export type UpdateWorkLogInputType = z.infer<typeof UpdateWorkLogInput>

/**
 * Soft-delete payload. `project_id` travels alongside `id` so the action can
 * revalidate the owning project page without an extra read.
 */
export const DeleteWorkLogInput = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
})
export type DeleteWorkLogInputType = z.infer<typeof DeleteWorkLogInput>
