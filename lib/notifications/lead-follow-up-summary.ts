import type { FollowUps } from '@/lib/integrations/follow-ups'

const STALE_HOURS = 24
const AT_RISK_HOURS = 72

export type LeadFollowUpSummary = {
  recipientId: string
  pendingLeads: number
  uncontactedLeads: number
  staleLeads: number
  atRiskLeads: number
  leadIds: string[]
  priorityLeads: LeadFollowUpPriority[]
}

export type LeadFollowUpPriority = {
  id: string
  name: string
  hours: number
  uncontacted: boolean
  atRisk: boolean
}

type PendingLead = {
  id: string
  name: string
  assignedTo: string | null
  hours: number
  uncontacted: boolean
  atRisk: boolean
}

function comparePriority(a: LeadFollowUpPriority, b: LeadFollowUpPriority): number {
  return (
    Number(b.atRisk) - Number(a.atRisk) ||
    Number(b.uncontacted) - Number(a.uncontacted) ||
    b.hours - a.hours ||
    a.name.localeCompare(b.name)
  )
}

export function collectLeadFollowUpSummaries(
  data: FollowUps,
  adminIds: string[],
): LeadFollowUpSummary[] {
  const leads = new Map<string, PendingLead>()
  for (const lead of data.staleLeads) {
    if (lead.hoursSince < STALE_HOURS) continue
    leads.set(lead.id, {
      id: lead.id,
      name: lead.name,
      assignedTo: lead.assignedTo,
      hours: lead.hoursSince,
      uncontacted: false,
      atRisk: lead.hoursSince >= AT_RISK_HOURS,
    })
  }
  for (const lead of data.uncontactedLeads) {
    const existing = leads.get(lead.id)
    leads.set(lead.id, {
      id: lead.id,
      name: lead.name,
      assignedTo: lead.assignedTo ?? existing?.assignedTo ?? null,
      hours: Math.max(lead.hoursUncontacted, existing?.hours ?? 0),
      uncontacted: true,
      atRisk: (existing?.atRisk ?? false) || lead.hoursUncontacted >= AT_RISK_HOURS,
    })
  }

  const summaries = new Map<string, LeadFollowUpSummary>()
  for (const lead of leads.values()) {
    const recipients =
      lead.atRisk || !lead.assignedTo
        ? [...new Set([...(lead.assignedTo ? [lead.assignedTo] : []), ...adminIds])]
        : [lead.assignedTo]
    for (const recipientId of recipients) {
      const summary = summaries.get(recipientId) ?? {
        recipientId,
        pendingLeads: 0,
        uncontactedLeads: 0,
        staleLeads: 0,
        atRiskLeads: 0,
        leadIds: [],
        priorityLeads: [],
      }
      summary.pendingLeads += 1
      if (lead.uncontacted) summary.uncontactedLeads += 1
      else summary.staleLeads += 1
      if (lead.atRisk) summary.atRiskLeads += 1
      summary.priorityLeads.push({
        id: lead.id,
        name: lead.name,
        hours: lead.hours,
        uncontacted: lead.uncontacted,
        atRisk: lead.atRisk,
      })
      summaries.set(recipientId, summary)
    }
  }
  return [...summaries.values()]
    .map((summary) => {
      const prioritized = summary.priorityLeads.sort(comparePriority)
      return {
        ...summary,
        leadIds: prioritized.map((lead) => lead.id),
        priorityLeads: prioritized.slice(0, 3),
      }
    })
    .sort((a, b) => a.recipientId.localeCompare(b.recipientId))
}

export function formatLeadFollowUpSummary(summary: LeadFollowUpSummary): string {
  const total = `${summary.pendingLeads} ${summary.pendingLeads === 1 ? 'lead requiere' : 'leads requieren'} atención`
  const categories = [
    summary.uncontactedLeads && `${summary.uncontactedLeads} sin primer contacto`,
    summary.staleLeads && `${summary.staleLeads} sin seguimiento`,
  ].filter((item): item is string => Boolean(item))
  const risk = summary.atRiskLeads ? `; ${summary.atRiskLeads} en riesgo` : ''
  const priority = summary.priorityLeads.map((lead) => `${lead.name} (${lead.hours} h)`)
  const lastPriority = priority.pop()
  const priorityText = lastPriority
    ? `. Prioridad: ${priority.length ? `${priority.join(', ')} y ` : ''}${lastPriority}.`
    : '.'
  return `${total}: ${categories.join(' y ')}${risk}${priorityText}`
}

export function buildLeadFollowUpLink(summary: LeadFollowUpSummary): string {
  const params = new URLSearchParams({ view: 'list', ids: summary.leadIds.join(',') })
  return `/leads?${params.toString()}`
}

type SummaryCounts = Pick<
  LeadFollowUpSummary,
  'pendingLeads' | 'uncontactedLeads' | 'staleLeads' | 'atRiskLeads'
>

export function parseLeadFollowUpSummary(body: string | null): SummaryCounts | null {
  if (!body) return null
  const pending = body.match(/(\d+) leads? (?:pendiente(?:s)?|requiere(?:n)? atención)/)
  if (!pending) return null
  return {
    pendingLeads: Number(pending[1]),
    uncontactedLeads: Number(body.match(/(\d+) sin primer contacto/)?.[1] ?? 0),
    staleLeads: Number(body.match(/(\d+) sin seguimiento/)?.[1] ?? 0),
    atRiskLeads: Number(body.match(/(\d+) (?:(?:está|están) )?en riesgo/)?.[1] ?? 0),
  }
}

/** Routine follow-ups stay in the daily digest; only urgent deterioration interrupts the day. */
export function shouldSendLeadFollowUpSummary(
  summary: LeadFollowUpSummary,
  previousBody: string | null | undefined,
): boolean {
  if (previousBody === undefined) {
    return summary.uncontactedLeads > 0 || summary.atRiskLeads > 0
  }
  const previous = parseLeadFollowUpSummary(previousBody)
  if (!previous) return false
  return (
    summary.atRiskLeads > previous.atRiskLeads ||
    summary.uncontactedLeads > previous.uncontactedLeads
  )
}
