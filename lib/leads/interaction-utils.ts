export type CallInteractionDetails = {
  transcript: string | null
  durationMinutes: number | null
  outcome: string | null
  callDate: string | null
}

export type LeadInteractionForAI = {
  type: string
  subject: string | null
  body: string | null
  payload: unknown
  created_at: string
}

type ResendInteraction = {
  resend_email_id: string | null
  type: string
  body?: unknown
  created_at?: string
}

const RESEND_STATUS_ORDER = [
  'email_scheduled',
  'email_sent',
  'email_delivered',
  'email_opened',
  'email_clicked',
  'email_received',
  'email_delivery_delayed',
  'email_bounced',
  'email_complained',
  'email_failed',
  'email_suppressed',
] as const

const resendStatusRank = new Map(RESEND_STATUS_ORDER.map((status, index) => [status, index]))

function hasInteractionBody(interaction: ResendInteraction): boolean {
  return typeof interaction.body === 'string' && interaction.body.trim().length > 0
}

function isNewerInteraction<T extends ResendInteraction>(candidate: T, current: T): boolean {
  if (!candidate.created_at || !current.created_at) return false
  return new Date(candidate.created_at).getTime() > new Date(current.created_at).getTime()
}

const HTML_ENTITY: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

/** Converts stored email HTML into safe, readable text while preserving meaningful line breaks. */
export function interactionBodyText(body: string | null): string | null {
  if (!body?.trim()) return null

  const text = body
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(div|h[1-6]|li|p|pre|table|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, code: string) => {
      const point = code.startsWith('#x')
        ? Number.parseInt(code.slice(2), 16)
        : code.startsWith('#')
          ? Number.parseInt(code.slice(1), 10)
          : null
      if (point !== null) {
        return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : entity
      }
      return HTML_ENTITY[code.toLowerCase()] ?? entity
    })
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || null
}

/** Groups the complete Resend lifecycle of an email into one timeline entry. */
export function groupResendInteractions<T extends ResendInteraction>(interactions: T[]) {
  const groups = new Map<
    string,
    { interaction: T; latestInteraction: T; count: number; statuses: string[] }
  >()
  const result: Array<{
    interaction: T
    latestInteraction: T
    count: number
    statuses: string[]
  }> = []

  for (const interaction of interactions) {
    if (!interaction.resend_email_id) {
      result.push({ interaction, latestInteraction: interaction, count: 1, statuses: [] })
      continue
    }

    const group = groups.get(interaction.resend_email_id)
    if (group) {
      group.count++
      if (!group.statuses.includes(interaction.type)) group.statuses.push(interaction.type)
      if (!hasInteractionBody(group.interaction) && hasInteractionBody(interaction)) {
        group.interaction = interaction
      }
      if (isNewerInteraction(interaction, group.latestInteraction)) {
        group.latestInteraction = interaction
      }
      continue
    }

    const next = {
      interaction,
      latestInteraction: interaction,
      count: 1,
      statuses: [interaction.type],
    }
    groups.set(interaction.resend_email_id, next)
    result.push(next)
  }

  for (const group of result) {
    group.statuses.sort(
      (a, b) =>
        (resendStatusRank.get(a as (typeof RESEND_STATUS_ORDER)[number]) ?? Number.MAX_VALUE) -
        (resendStatusRank.get(b as (typeof RESEND_STATUS_ORDER)[number]) ?? Number.MAX_VALUE),
    )
  }

  return result
}

/** Safely reads the structured metadata stored on a call interaction. */
export function getCallInteractionDetails(payload: unknown): CallInteractionDetails {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { transcript: null, durationMinutes: null, outcome: null, callDate: null }
  }

  const data = payload as Record<string, unknown>
  const transcript = typeof data.transcript === 'string' ? data.transcript.trim() : ''
  const durationMinutes =
    typeof data.duration_minutes === 'number' && Number.isFinite(data.duration_minutes)
      ? data.duration_minutes
      : null
  const outcome = typeof data.outcome === 'string' ? data.outcome : null
  const callDate =
    typeof data.call_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.call_date)
      ? data.call_date
      : null

  return {
    transcript: transcript || null,
    durationMinutes,
    outcome,
    callDate,
  }
}

/** Returns the business date of an interaction, falling back to its audit timestamp. */
export function interactionDate(interaction: LeadInteractionForAI): string {
  if (interaction.type !== 'call') return interaction.created_at
  return getCallInteractionDetails(interaction.payload).callDate ?? interaction.created_at
}

function describeInteractionAge(
  interaction: LeadInteractionForAI,
  relativeTo: Date,
): string | null {
  const occurredAt = new Date(interactionDate(interaction))
  if (Number.isNaN(occurredAt.getTime()) || Number.isNaN(relativeTo.getTime())) return null

  const dayMs = 24 * 60 * 60 * 1000
  const occurredDay = Date.UTC(
    occurredAt.getUTCFullYear(),
    occurredAt.getUTCMonth(),
    occurredAt.getUTCDate(),
  )
  const relativeDay = Date.UTC(
    relativeTo.getUTCFullYear(),
    relativeTo.getUTCMonth(),
    relativeTo.getUTCDate(),
  )
  const days = Math.floor((relativeDay - occurredDay) / dayMs)

  if (days < 0) return `dentro de ${Math.abs(days)} día${days === -1 ? '' : 's'}`
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`

  const months = Math.round(days / 30)
  if (days < 365) return `hace aprox. ${months} mes${months === 1 ? '' : 'es'} (${days} días)`

  const years = Math.round(days / 365)
  return `hace aprox. ${years} año${years === 1 ? '' : 's'} (${days} días)`
}

function formatInteraction(interaction: LeadInteractionForAI, relativeTo?: Date): string {
  const date = interactionDate(interaction).slice(0, 10)
  const age = relativeTo ? describeInteractionAge(interaction, relativeTo) : null
  const subject = interaction.subject?.trim()
  const notes = interaction.body?.trim()?.slice(0, 300)
  const callDetails =
    interaction.type === 'call' ? getCallInteractionDetails(interaction.payload) : null
  const transcript = callDetails?.transcript?.slice(0, 2000)
  const callMetadata = [
    callDetails?.outcome ? `Resultado: ${callDetails.outcome}` : null,
    callDetails?.durationMinutes != null ? `Duración: ${callDetails.durationMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const meetingData =
    interaction.type === 'meeting' && interaction.payload && typeof interaction.payload === 'object'
      ? (interaction.payload as Record<string, unknown>)
      : null
  const meetingTime = meetingData?.start
    ? `Reunión: ${String(meetingData.start)}${meetingData.end ? ` → ${String(meetingData.end)}` : ''}`
    : ''
  const notesDetail = notes ? ` | Notas: ${notes}` : ''
  const transcriptDetail = transcript ? ` | Transcripción: ${transcript}` : ''

  return `- ${date}${age ? ` (${age})` : ''} | ${interaction.type}${subject ? ` | "${subject}"` : ''}${notesDetail}${callMetadata ? ` | ${callMetadata}` : ''}${meetingTime ? ` | ${meetingTime}` : ''}${transcriptDetail}`
}

/** Formats one interaction for an AI prompt. */
export function formatInteractionForAI(interaction: LeadInteractionForAI): string {
  return formatInteraction(interaction)
}

/** Formats one interaction for an AI prompt and makes its age explicit. */
export function formatDatedInteractionForAI(
  interaction: LeadInteractionForAI,
  relativeTo: Date,
): string {
  return formatInteraction(interaction, relativeTo)
}
