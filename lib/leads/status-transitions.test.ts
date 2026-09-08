import { describe, expect, it } from 'vitest'

import { followUpDelayHours, normalizePhoneForCall } from './call-workflow'
import {
  buildLeadStatusPatch,
  canAutomateLeadAccessibility,
  canPromoteLeadAfterConnectedCall,
} from './status-transitions'
import { buildLeadWhatsAppMessage, buildWhatsAppUrl } from './whatsapp'

describe('lead transition rules', () => {
  it('records a closure reason and timestamp only for closure stages', () => {
    expect(
      buildLeadStatusPatch({
        status: 'lost',
        lostReason: 'Sin presupuesto',
        userId: 'member-1',
        now: '2026-08-11T10:00:00.000Z',
      }),
    ).toMatchObject({ lost_reason: 'Sin presupuesto', lost_at: '2026-08-11T10:00:00.000Z' })
    expect(
      buildLeadStatusPatch({ status: 'contacted', userId: 'member-1', now: 'now' }),
    ).toMatchObject({ lost_reason: null, lost_at: null })
  })

  it('never replaces a manual accessibility decision', () => {
    expect(canAutomateLeadAccessibility({ value: false, source: 'manual' })).toBe(false)
    expect(canAutomateLeadAccessibility({ value: null, source: null })).toBe(true)
    expect(canPromoteLeadAfterConnectedCall('new')).toBe(true)
    expect(canPromoteLeadAfterConnectedCall('quoted')).toBe(false)
  })
})

describe('lead call helpers', () => {
  it('uses the expected retry cadence and normalizes action phone links', () => {
    expect(followUpDelayHours('busy')).toBe(4)
    expect(followUpDelayHours('no_answer')).toBe(24)
    expect(followUpDelayHours('connected')).toBeNull()
    expect(normalizePhoneForCall('+34 600-123-456')).toBe('+34600123456')
  })

  it('builds a safe WhatsApp link from a Spanish local number', () => {
    const message = buildLeadWhatsAppMessage(
      { id: 'lead-1', name: 'Ana García', email: null },
      'Pol',
      undefined,
    )
    expect(buildWhatsAppUrl('600 123 456', message)).toContain('https://wa.me/34600123456?text=')
  })
})
