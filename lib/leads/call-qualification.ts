/** Call outcomes that show the lead was actually reachable. */
const CONNECTED_OUTCOME = 'connected'

/** Attempts that did not establish contact, but keep the phone number valid. */
const UNANSWERED_OUTCOMES = new Set(['no_answer', 'busy', 'voicemail'])

export type CallQualificationSummary = {
  connected: number
  unanswered: number
  noAnswerStreak: number
}

function outcomeFromInteraction(interaction: unknown): string | null {
  if (!interaction || typeof interaction !== 'object') return null
  const payload = (interaction as { payload?: unknown }).payload
  if (!payload || typeof payload !== 'object') return null
  const outcome = (payload as { outcome?: unknown }).outcome
  return typeof outcome === 'string' ? outcome : null
}

/**
 * Summarises call history for qualification. Calls are expected newest first;
 * only consecutive `no_answer` calls count towards the WhatsApp follow-up.
 */
export function summarizeCallOutcomes(calls: readonly unknown[]): CallQualificationSummary {
  let connected = 0
  let unanswered = 0
  let noAnswerStreak = 0
  let streakOpen = true

  for (const call of calls) {
    const outcome = outcomeFromInteraction(call)
    if (outcome === CONNECTED_OUTCOME) connected += 1
    if (outcome && UNANSWERED_OUTCOMES.has(outcome)) unanswered += 1

    if (streakOpen && outcome === 'no_answer') {
      noAnswerStreak += 1
    } else {
      streakOpen = false
    }
  }

  return { connected, unanswered, noAnswerStreak }
}

/** A lead is reachable when successful conversations outnumber missed attempts. */
export function isAutomaticallyAccessible(summary: CallQualificationSummary): boolean {
  return summary.connected > summary.unanswered
}
