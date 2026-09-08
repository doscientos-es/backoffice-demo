import { describe, expect, it } from 'vitest'

import {
  EXPENSE_STATUS,
  INVOICE_STATUS,
  LEAD_STATUS,
  MEETING_PROJECT_STATUSES,
  PROJECT_STATUS,
  PROPOSAL_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
  VERIFACTU_ALERT_STATUS,
  VERIFACTU_STATUS,
} from '@/lib/status'

const VALID_VARIANTS = new Set(['neutral', 'info', 'success', 'warning', 'danger'])

const ALL_MAPS = {
  INVOICE_STATUS,
  PROPOSAL_STATUS,
  LEAD_STATUS,
  PROJECT_STATUS,
  TASK_STATUS,
  TASK_PRIORITY,
  VERIFACTU_STATUS,
  VERIFACTU_ALERT_STATUS,
  EXPENSE_STATUS,
}

describe('status metadata maps', () => {
  for (const [name, map] of Object.entries(ALL_MAPS)) {
    describe(name, () => {
      it('has a non-empty label and a known variant for every entry', () => {
        const entries = Object.values(map)
        expect(entries.length).toBeGreaterThan(0)
        for (const entry of entries) {
          expect(entry.label.length).toBeGreaterThan(0)
          expect(VALID_VARIANTS.has(entry.variant)).toBe(true)
        }
      })
    })
  }
})

describe('specific mappings', () => {
  it('renders proposal.sent consistently', () => {
    expect(PROPOSAL_STATUS.sent).toEqual({ label: 'Enviada', variant: 'info' })
  })
  it('maps invoice states', () => {
    expect(INVOICE_STATUS.paid.variant).toBe('success')
    expect(INVOICE_STATUS.overdue.variant).toBe('danger')
  })
  it('maps lead and task states', () => {
    expect(LEAD_STATUS.won.variant).toBe('success')
    expect(TASK_STATUS.done.variant).toBe('success')
    expect(TASK_PRIORITY.urgent.variant).toBe('danger')
  })
  it('uses only valid active project states when scheduling a meeting', () => {
    expect(MEETING_PROJECT_STATUSES).toEqual(['planning', 'active', 'on_hold'])
  })
  it('maps verifactu states (full + alert subset)', () => {
    expect(VERIFACTU_STATUS.accepted.variant).toBe('success')
    expect(VERIFACTU_ALERT_STATUS.error.variant).toBe('danger')
  })
  it('borrows expense labels from lib/finance', () => {
    expect(EXPENSE_STATUS.paid.label).toBe('Pagado')
    expect(EXPENSE_STATUS.pending.variant).toBe('info')
  })
})
