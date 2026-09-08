import { externalAppUrl } from '@/lib/email/app-url'
import { publicEnv } from '@/lib/env'
import { ACTIVE_LEAD_STATUSES } from '@/lib/leads/pipeline'
import { findLeadIdsWithScheduledContact } from '@/lib/leads/scheduled-contact'
import { LEAD_STATUS, PROPOSAL_STATUS } from '@/lib/status'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Read-only data source for the n8n "follow-up" cron workflows.
 *
 * The dashboard already surfaces this information (stale owned leads in
 * `getMyDay`, open proposals in `countOpenProposals`) but those queries are
 * RLS-bound to a logged-in member via `createServerClient`. The cron jobs run
 * unauthenticated (shared-secret only), so we mirror the same business rules
 * here through the service-role client.
 */

const DEFAULT_LEAD_HOURS = 24
const DEFAULT_PROPOSAL_HOURS = 72
/** Speed-to-lead SLA: alert when a new lead has no first contact after this many hours. */
const DEFAULT_SLA_HOURS = 4
const LIST_LIMIT = 25

/** Proposal statuses that are awaiting a client response. */
const PENDING_PROPOSAL_STATUSES = ['sent', 'viewed'] as const

export type StaleLead = {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  status: string
  statusLabel: string
  assignedTo: string | null
  since: string
  hoursSince: number
  url: string
}

export type PendingProposal = {
  id: string
  number: string | null
  title: string
  status: string
  statusLabel: string
  recipient: string | null
  since: string
  hoursSince: number
  url: string
}

export type UncontactedLead = {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  source: string | null
  assignedTo: string | null
  createdAt: string
  hoursUncontacted: number
  url: string
}

export type FollowUps = {
  generatedAt: string
  thresholds: { leadHours: number; proposalHours: number; slaHours: number }
  counts: { staleLeads: number; pendingProposals: number; uncontactedLeads: number }
  /** Speed-to-lead SLA breaches: new/qualifying leads with no first_contacted_at. */
  uncontactedLeads: UncontactedLead[]
  staleLeads: StaleLead[]
  pendingProposals: PendingProposal[]
}

type NameRef = { name: string } | { name: string }[] | null

/** Embedded to-one relations can come back as an object or a single-item array. */
function refName(ref: NameRef): string | null {
  if (!ref) return null
  return Array.isArray(ref) ? (ref[0]?.name ?? null) : ref.name
}

function hoursBetween(fromIso: string, now: number): number {
  return Math.floor((now - new Date(fromIso).getTime()) / 3_600_000)
}

export async function getFollowUps(opts?: {
  leadHours?: number
  proposalHours?: number
  slaHours?: number
}): Promise<FollowUps> {
  const leadHours = opts?.leadHours ?? DEFAULT_LEAD_HOURS
  const proposalHours = opts?.proposalHours ?? DEFAULT_PROPOSAL_HOURS
  const slaHours = opts?.slaHours ?? DEFAULT_SLA_HOURS
  const supabase = createAdminClient()
  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
  const now = Date.now()
  const leadCutoff = new Date(now - leadHours * 3_600_000).toISOString()
  const proposalCutoff = new Date(now - proposalHours * 3_600_000).toISOString()
  const slaCutoff = new Date(now - slaHours * 3_600_000).toISOString()

  const [leadsRes, proposalsRes, uncontactedRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, company, phone, email, status, assigned_to, updated_at')
      .in('status', [...ACTIVE_LEAD_STATUSES])
      .lt('updated_at', leadCutoff)
      .is('deleted_at', null)
      .order('updated_at', { ascending: true })
      .limit(LIST_LIMIT),
    supabase
      .from('proposals')
      .select('id, number, title, status, sent_at, clients(name), leads(name)')
      .in('status', [...PENDING_PROPOSAL_STATUSES])
      .is('responded_at', null)
      .not('sent_at', 'is', null)
      .lt('sent_at', proposalCutoff)
      .is('deleted_at', null)
      .order('sent_at', { ascending: true })
      .limit(LIST_LIMIT),
    // Speed-to-lead SLA: new leads without any first outbound contact
    supabase
      .from('leads')
      .select('id, name, company, phone, email, source, assigned_to, created_at')
      .in('status', ['new', 'qualifying'])
      .is('first_contacted_at', null)
      .lt('created_at', slaCutoff)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(LIST_LIMIT),
  ])

  const candidateLeadIds = [
    ...(leadsRes.data ?? []).map((lead) => lead.id as string),
    ...(uncontactedRes.data ?? []).map((lead) => lead.id as string),
  ]
  const scheduledContactLeadIds = await findLeadIdsWithScheduledContact(
    supabase,
    candidateLeadIds,
    new Date(now),
  )

  const staleLeads: StaleLead[] = (leadsRes.data ?? [])
    .filter((r) => !scheduledContactLeadIds.has(r.id as string))
    .map((r) => {
      const status = r.status as keyof typeof LEAD_STATUS
      const since = (r.updated_at as string) ?? new Date(now).toISOString()
      return {
        id: r.id as string,
        name: r.name as string,
        company: (r.company as string | null) ?? null,
        phone: (r.phone as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        status,
        statusLabel: LEAD_STATUS[status]?.label ?? status,
        assignedTo: (r.assigned_to as string | null) ?? null,
        since,
        hoursSince: hoursBetween(since, now),
        url: `${appUrl}/leads/${r.id}`,
      }
    })

  const pendingProposals: PendingProposal[] = (proposalsRes.data ?? []).map((r) => {
    const status = r.status as keyof typeof PROPOSAL_STATUS
    const since = (r.sent_at as string) ?? new Date(now).toISOString()
    return {
      id: r.id as string,
      number: (r.number as string | null) ?? null,
      title: r.title as string,
      status,
      statusLabel: PROPOSAL_STATUS[status]?.label ?? status,
      recipient: refName(r.clients as NameRef) ?? refName(r.leads as NameRef),
      since,
      hoursSince: hoursBetween(since, now),
      url: `${appUrl}/proposals/${r.id}`,
    }
  })

  const uncontactedLeads: UncontactedLead[] = (uncontactedRes.data ?? [])
    .filter((r) => !scheduledContactLeadIds.has(r.id as string))
    .map((r) => {
      const createdAt = (r.created_at as string) ?? new Date(now).toISOString()
      return {
        id: r.id as string,
        name: r.name as string,
        company: (r.company as string | null) ?? null,
        phone: (r.phone as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        source: (r.source as string | null) ?? null,
        assignedTo: (r.assigned_to as string | null) ?? null,
        createdAt,
        hoursUncontacted: hoursBetween(createdAt, now),
        url: `${appUrl}/leads/${r.id}`,
      }
    })

  return {
    generatedAt: new Date(now).toISOString(),
    thresholds: { leadHours, proposalHours, slaHours },
    counts: {
      staleLeads: staleLeads.length,
      pendingProposals: pendingProposals.length,
      uncontactedLeads: uncontactedLeads.length,
    },
    uncontactedLeads,
    staleLeads,
    pendingProposals,
  }
}
