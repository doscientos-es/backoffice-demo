import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeadDetailDisclosure } from './lead-detail-disclosure'

describe('LeadDetailDisclosure', () => {
  it('keeps secondary content collapsed until the user asks to see it', () => {
    render(
      <LeadDetailDisclosure id="qualification" title="Calificación">
        <p>Señales de un buen lead</p>
      </LeadDetailDisclosure>,
    )

    const trigger = screen.getByRole('button', { name: 'Calificación' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Señales de un buen lead')).toBeDefined()
  })
})
