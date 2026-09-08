import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeadCompanyResearch } from './lead-company-research'

describe('LeadCompanyResearch', () => {
  it('does not offer research when its optional schema is unavailable', () => {
    render(
      <LeadCompanyResearch
        leadId="00000000-0000-4000-8000-000000000001"
        email="contact@acme.test"
        canEdit
        aiEnabled
        available={false}
        initialResearch={null}
        initialResearchedAt={null}
      />,
    )

    expect(screen.getByText(/estará disponible cuando termine de actualizarse/i)).toBeDefined()
    expect(screen.queryByRole('button', { name: /investigar empresa/i })).toBeNull()
  })

  it('offers research once its schema is available', () => {
    render(
      <LeadCompanyResearch
        leadId="00000000-0000-4000-8000-000000000001"
        email="contact@acme.test"
        canEdit
        aiEnabled
        available
        initialResearch={null}
        initialResearchedAt={null}
      />,
    )

    expect(screen.getByRole('button', { name: /investigar empresa/i })).toBeDefined()
    expect(screen.queryByText(/estará disponible cuando termine de actualizarse/i)).toBeNull()
  })
})
