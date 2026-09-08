import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeadCommercial } from './lead-commercial'

describe('LeadCommercial', () => {
  it('keeps commercial records compact and directly linked on mobile', () => {
    render(
      <LeadCommercial
        leadId="lead-1"
        linkedClientId="client-1"
        proposals={[
          {
            id: 'proposal-1',
            number: 'P-2026-001',
            title: 'Automatización',
            status: 'draft',
            total: 1200,
            valid_until: null,
            sent_at: null,
            viewed_at: null,
            responded_at: null,
            notes: null,
          },
        ]}
        projects={[]}
        invoices={[]}
      />,
    )

    const mobileSection = screen.getByRole('region', { name: 'Relaciones comerciales' })
    const trigger = within(mobileSection).getByRole('button', { name: /relaciones comerciales/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)

    expect(
      within(mobileSection)
        .getByRole('link', { name: /P-2026-001/ })
        .getAttribute('href'),
    ).toBe('/proposals/proposal-1')
    expect(
      within(mobileSection).getByRole('link', { name: 'Crear proyecto' }).getAttribute('href'),
    ).toBe('/projects/new?client_id=client-1')
  })
})
