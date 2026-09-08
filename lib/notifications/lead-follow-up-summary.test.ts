import { describe, expect, it } from 'vitest'

import type { FollowUps } from '@/lib/integrations/follow-ups'

import {
  buildLeadFollowUpLink,
  collectLeadFollowUpSummaries,
  formatLeadFollowUpSummary,
  parseLeadFollowUpSummary,
  shouldSendLeadFollowUpSummary,
} from './lead-follow-up-summary'

const base: FollowUps = {
  generatedAt: '2026-08-22T10:00:00.000Z',
  thresholds: { leadHours: 24, proposalHours: 72, slaHours: 4 },
  counts: { staleLeads: 0, pendingProposals: 0, uncontactedLeads: 0 },
  staleLeads: [],
  uncontactedLeads: [],
  pendingProposals: [],
}

describe('lead follow-up summaries', () => {
  it('turns ten pending leads for one person into one summary', () => {
    const summaries = collectLeadFollowUpSummaries(
      {
        ...base,
        staleLeads: Array.from({ length: 10 }, (_, index) => ({
          id: `lead-${index}`,
          name: `Lead ${index}`,
          company: null,
          phone: null,
          email: null,
          status: 'contacted',
          statusLabel: 'Contactado',
          assignedTo: 'member-1',
          since: '2026-08-20T10:00:00.000Z',
          hoursSince: 48,
          url: `/leads/lead-${index}`,
        })),
      },
      [],
    )

    expect(summaries).toHaveLength(1)
    expect(formatLeadFollowUpSummary(summaries[0]!)).toBe(
      '10 leads requieren atención: 10 sin seguimiento. Prioridad: Lead 0 (48 h), Lead 1 (48 h) y Lead 2 (48 h).',
    )
    expect(summaries[0]?.leadIds).toHaveLength(10)
  })

  it('groups each lead once per recipient and escalates at-risk leads to admins', () => {
    const summaries = collectLeadFollowUpSummaries(
      {
        ...base,
        staleLeads: [
          {
            id: 'lead-1',
            name: 'Lead 1',
            company: null,
            phone: null,
            email: null,
            status: 'new',
            statusLabel: 'Nuevo',
            assignedTo: 'member-1',
            since: '2026-08-19T10:00:00.000Z',
            hoursSince: 72,
            url: '/leads/lead-1',
          },
        ],
        uncontactedLeads: [
          {
            id: 'lead-1',
            name: 'Lead 1',
            company: null,
            phone: null,
            email: null,
            source: null,
            assignedTo: 'member-1',
            createdAt: '2026-08-19T10:00:00.000Z',
            hoursUncontacted: 72,
            url: '/leads/lead-1',
          },
        ],
      },
      ['admin-1'],
    )

    expect(summaries).toMatchObject([
      {
        recipientId: 'admin-1',
        pendingLeads: 1,
        uncontactedLeads: 1,
        staleLeads: 0,
        atRiskLeads: 1,
      },
      {
        recipientId: 'member-1',
        pendingLeads: 1,
        uncontactedLeads: 1,
        staleLeads: 0,
        atRiskLeads: 1,
      },
    ])
    expect(formatLeadFollowUpSummary(summaries[1]!)).toBe(
      '1 lead requiere atención: 1 sin primer contacto; 1 en riesgo. Prioridad: Lead 1 (72 h).',
    )
    expect(buildLeadFollowUpLink(summaries[1]!)).toBe('/leads?view=list&ids=lead-1')
  })

  it('prioritizes at-risk and uncontacted leads before less urgent follow-ups', () => {
    const summaries = collectLeadFollowUpSummaries(
      {
        ...base,
        staleLeads: [
          {
            id: 'stale',
            name: 'Seguimiento',
            company: null,
            phone: null,
            email: null,
            status: 'contacted',
            statusLabel: 'Contactado',
            assignedTo: 'member-1',
            since: '2026-08-21T04:00:00.000Z',
            hoursSince: 30,
            url: '/leads/stale',
          },
        ],
        uncontactedLeads: [
          {
            id: 'urgent',
            name: 'Urgente',
            company: null,
            phone: null,
            email: null,
            source: null,
            assignedTo: 'member-1',
            createdAt: '2026-08-18T10:00:00.000Z',
            hoursUncontacted: 96,
            url: '/leads/urgent',
          },
        ],
      },
      ['admin-1'],
    )

    expect(summaries[1]?.leadIds).toEqual(['urgent', 'stale'])
    expect(summaries[1]?.priorityLeads[0]).toMatchObject({
      id: 'urgent',
      uncontacted: true,
      atRisk: true,
    })
    expect(summaries[0]?.leadIds).toEqual(['urgent'])
  })

  it('suppresses unchanged summaries but sends material deteriorations during cooldown', () => {
    const summary = collectLeadFollowUpSummaries(
      {
        ...base,
        uncontactedLeads: [
          {
            id: 'lead-1',
            name: 'Lead 1',
            company: null,
            phone: null,
            email: null,
            source: null,
            assignedTo: 'member-1',
            createdAt: '2026-08-19T10:00:00.000Z',
            hoursUncontacted: 72,
            url: '/leads/lead-1',
          },
        ],
      },
      [],
    )[0]!
    const currentBody = formatLeadFollowUpSummary(summary)

    expect(parseLeadFollowUpSummary(currentBody)).toEqual({
      pendingLeads: 1,
      uncontactedLeads: 1,
      staleLeads: 0,
      atRiskLeads: 1,
    })
    expect(shouldSendLeadFollowUpSummary(summary, undefined)).toBe(true)
    expect(shouldSendLeadFollowUpSummary(summary, currentBody)).toBe(false)
    expect(shouldSendLeadFollowUpSummary(summary, '1 lead pendiente: 1 sin seguimiento.')).toBe(
      true,
    )
  })

  it('leaves routine stale-lead growth for the daily digest', () => {
    const routineSummary = {
      recipientId: 'member-1',
      pendingLeads: 4,
      uncontactedLeads: 0,
      staleLeads: 4,
      atRiskLeads: 0,
      leadIds: ['lead-1', 'lead-2', 'lead-3', 'lead-4'],
      priorityLeads: [],
    }

    expect(shouldSendLeadFollowUpSummary(routineSummary, undefined)).toBe(false)
    expect(
      shouldSendLeadFollowUpSummary(routineSummary, '1 lead requiere atención: 1 sin seguimiento.'),
    ).toBe(false)
  })
})
