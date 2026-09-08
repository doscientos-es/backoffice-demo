import { describe, expect, it } from 'vitest'

import {
  buildProposalItemRows,
  buildProposalTotalsPatch,
  isProposalEditable,
  type ProposalItemInput,
} from './items'

const items: ProposalItemInput[] = [
  { description: 'Diseño', quantity: 2, unit_price: 100, vat_rate: 21, billing_cycle: 'none' },
]

describe('proposal item helpers', () => {
  it('keeps line ordering and recomputes totals on the server', () => {
    expect(buildProposalItemRows(items, 'proposal-1')).toEqual([
      { ...items[0], proposal_id: 'proposal-1', position: 0 },
    ])
    expect(buildProposalTotalsPatch(items)).toEqual({ subtotal: 200, tax_amount: 42, total: 242 })
  })

  it('only allows draft and sent proposals to be edited', () => {
    expect(isProposalEditable('draft')).toBe(true)
    expect(isProposalEditable('sent')).toBe(true)
    expect(isProposalEditable('accepted')).toBe(false)
    expect(isProposalEditable('rejected')).toBe(false)
  })
})
