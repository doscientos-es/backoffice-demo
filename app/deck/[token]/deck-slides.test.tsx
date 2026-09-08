import { describe, expect, it } from 'vitest'

import { buildSlides } from './deck-slides'
import type { DeckProposal } from './page'

const proposal: DeckProposal = {
  id: 'proposal-1',
  number: 'P-001',
  title: 'Propuesta de prueba',
  context_markdown: null,
  problems: [],
  solutions: [],
  terms: null,
  scope_modules: [],
  deliverables: ' \n ',
  acceptance_criteria: '\n',
  payment_schedule: 'half_half',
  payment_terms: null,
  change_management_terms: null,
  notes: null,
  subtotal: 0,
  tax_amount: 0,
  total: 0,
  valid_until: null,
  created_at: null,
  client_name: null,
  client_email: null,
  client_logo_url: null,
}

describe('buildSlides', () => {
  it('omits the delivery slide when deliverables and criteria only contain whitespace', () => {
    const slides = buildSlides(proposal, [], 'portal-token')

    expect(slides).not.toContainEqual(expect.objectContaining({ key: 'delivery' }))
  })

  it('omits the context slide when context only contains whitespace', () => {
    const slides = buildSlides({ ...proposal, context_markdown: ' \n ' }, [], 'portal-token')

    expect(slides).not.toContainEqual(expect.objectContaining({ key: 'context' }))
  })

  it('includes the delivery slide when either field has meaningful content', () => {
    const slides = buildSlides(
      { ...proposal, deliverables: '- Sitio web publicado' },
      [],
      'portal-token',
    )

    expect(slides).toContainEqual(expect.objectContaining({ key: 'delivery' }))
  })
})
