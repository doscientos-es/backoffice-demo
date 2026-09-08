import { scopedLogger } from '@/lib/logger'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

import { type LeadIntake, parseEmployeeFloor, urgencyWeight } from './lead-intake'

const log = scopedLogger('lead-pipeline')
const FIRST_TOUCH_MARKER = 'AUTO_LEAD_FIRST_TOUCH'

function firstTouchDelayMinutes(input: LeadIntake, score: number): number {
  const urgency = input.urgency?.toLowerCase()
  if (urgency === 'inmediata' || urgency === 'urgent' || urgency === 'asap') return 5
  if (score >= 70) return 10
  if (score >= 45) return 20
  return 60
}

async function createFirstTouchReminder(
  supabase: ReturnType<typeof createAdminClient>,
  leadId: string,
  input: LeadIntake,
  assignedTo: string,
  score: number,
): Promise<void> {
  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('lead_id', leadId)
    .eq('kind', 'reminder')
    .eq('description', FIRST_TOUCH_MARKER)
    .maybeSingle()
  if (existing) return

  const delayMinutes = firstTouchDelayMinutes(input, score)
  const startAt = new Date(Date.now() + delayMinutes * 60_000).toISOString()
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      kind: 'reminder',
      title: `Primer contacto · ${input.name}`,
      description: FIRST_TOUCH_MARKER,
      start_at: startAt,
      lead_id: leadId,
      created_by: assignedTo,
      assignee_id: assignedTo,
      status: 'todo',
      priority: score >= 70 ? 'high' : 'medium',
    })
    .select('id')
    .maybeSingle()

  if (error || !task) {
    log.error({ err: error, leadId }, 'first touch reminder creation failed')
    return
  }

  await dispatchNotifications({
    recipientIds: [assignedTo],
    eventType: 'lead_assigned',
    entityType: 'lead',
    entityId: leadId,
    body: `Nuevo lead asignado. Primer contacto recomendado en ${delayMinutes} min.`,
    link: `/leads/${leadId}`,
    actions: input.phone
      ? [
          { action: 'call', title: 'Llamar' },
          { action: 'whatsapp', title: 'WhatsApp' },
          { action: 'feedback', title: 'Registrar' },
        ]
      : [{ action: 'feedback', title: 'Registrar' }],
    data: {
      taskId: task.id as string,
      score: String(score),
      firstTouchInMinutes: String(delayMinutes),
      callUrl: input.phone ? `tel:${input.phone.replace(/\D/g, '')}` : null,
      whatsappUrl: input.phone ? `https://wa.me/${input.phone.replace(/\D/g, '')}` : null,
      feedbackUrl: `/leads/${leadId}?feedback=call`,
    },
  })
}

// ── Scoring ───────────────────────────────────────────────────────────────

const PAID_MEDIUMS = new Set(['paid_social', 'paid', 'cpc', 'cpm', 'ppc', 'paidsocial', 'display'])

/**
 * Rule-based lead score (0–100), weighted toward *closeability* rather than
 * mere contact completeness. A lead with a big budget, urgent timeline and a
 * decision-maker on the form outranks one that merely left every contact field.
 *
 * Contact completeness (+35):  email +15, phone +15, company +5
 * Estimated value      (+25):  ≥30k +25, ≥10k +18, ≥5k +10, >0 +5
 * Urgency              (+15):  urgencyWeight × 15 (inmediata=15 … explorando≈1.5)
 * Decision maker       (+10):  form answer indicates sign-off authority
 * Company size         (+8):   ≥200 +8, ≥50 +5, ≥10 +3
 * Paid attribution     (+7):   paid medium +4, campaign present +3
 */
export function scoreLeadIntake(input: LeadIntake): number {
  let score = 0

  // Contact completeness
  if (input.email) score += 15
  if (input.phone) score += 15
  if (input.company) score += 5

  // Estimated value (budget) — strongest close predictor
  const value = input.estimatedValue ?? 0
  if (value >= 30_000) score += 25
  else if (value >= 10_000) score += 18
  else if (value >= 5_000) score += 10
  else if (value > 0) score += 5

  // Urgency / timeline
  score += Math.round(urgencyWeight(input.urgency) * 15)

  // Company size (firmographic)
  const employees = parseEmployeeFloor(input.companySize) ?? 0
  if (employees >= 200) score += 8
  else if (employees >= 50) score += 5
  else if (employees >= 10) score += 3

  // Paid attribution
  if (input.utm?.medium && PAID_MEDIUMS.has(input.utm.medium.toLowerCase())) score += 4
  if (input.utm?.campaign) score += 3

  return Math.min(score, 100)
}

// ── Round-robin assignment ────────────────────────────────────────────────

/**
 * Returns the id of the team member with the fewest leads assigned in the last
 * 30 days. Tie-break: earliest `created_at` (most senior member).
 * Returns null when no active members exist.
 */
async function pickRoundRobinAssignee(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data: members, error } = await supabase
    .from('team_members')
    .select('id')
    .is('deleted_at', null)
    .eq('leads_assignable', true)
    .order('created_at') // oldest first → tie-break

  if (error || !members?.length) return null

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recent } = await supabase
    .from('leads')
    .select('assigned_to')
    .is('deleted_at', null)
    .not('assigned_to', 'is', null)
    .gte('created_at', thirtyDaysAgo)

  // Build count map, initialising every active member at 0
  const counts = new Map<string, number>(members.map((m) => [m.id as string, 0]))
  for (const lead of recent ?? []) {
    const id = lead.assigned_to as string | null
    if (id && counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  // Pick member with the lowest count (order preserves tie-break)
  let minId: string | null = null
  let minCount = Number.POSITIVE_INFINITY
  for (const [id, count] of counts) {
    if (count < minCount) {
      minCount = count
      minId = id
    }
  }

  return minId
}

// ── Pipeline entry point ──────────────────────────────────────────────────

/**
 * Post-insert pipeline executed for every lead entering via ingestLead().
 *
 * Steps:
 *   1. Compute rule-based score (0–100).
 *   2. Pick round-robin assignee (fewest leads in last 30 days).
 *   3. Create a durable first-touch reminder for the assignee.
 *
 * Errors are logged and never propagate — callers should invoke
 * with `.catch(() => {})` so lead creation is never blocked.
 */
export async function runLeadPipeline(leadId: string, input: LeadIntake): Promise<void> {
  const supabase = createAdminClient()

  try {
    const score = scoreLeadIntake(input)
    const assignedTo = await pickRoundRobinAssignee(supabase)

    const updates: Record<string, unknown> = { score }
    if (assignedTo) updates.assigned_to = assignedTo

    const { error } = await supabase.from('leads').update(updates).eq('id', leadId)

    if (error) {
      log.error({ err: error, leadId }, 'pipeline update failed')
    } else {
      if (assignedTo) await createFirstTouchReminder(supabase, leadId, input, assignedTo, score)
      log.info({ leadId, score, assigned: Boolean(assignedTo) }, 'lead pipeline applied')
    }
  } catch (e) {
    log.error({ err: e, leadId }, 'lead pipeline threw unexpectedly')
  }
}
