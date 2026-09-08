import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

import { MaintenanceOfferEditor } from './maintenance-offer-editor'

describe('MaintenanceOfferEditor', () => {
  it('uses the default maintenance heading', () => {
    render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        selectedPlanId={null}
        onChange={vi.fn()}
        onSelectedPlanChange={vi.fn()}
        locked={false}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Mantenimiento' })).toBeDefined()
    expect(screen.queryByText('Mantenimiento opcional')).toBeNull()
  })

  it('keeps multiline edits until blur and imports pasted bullet lists', () => {
    const onChange = vi.fn()
    render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        selectedPlanId={null}
        onChange={onChange}
        onSelectedPlanChange={vi.fn()}
        locked={false}
      />,
    )

    const exclusions = screen.getByLabelText('Exclusiones del plan Esencial')
    fireEvent.change(exclusions, {
      target: { value: '- Cambios de contenido\n• Nuevas integraciones\n3. Formación' },
    })
    expect((exclusions as HTMLTextAreaElement).value).toContain('\n• Nuevas integraciones')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(exclusions)

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plans: expect.arrayContaining([
          expect.objectContaining({
            id: 'essential',
            exclusions: ['Cambios de contenido', 'Nuevas integraciones', 'Formación'],
          }),
        ]),
      }),
    )
  })

  it('lets the team choose the plan recommended to the client', () => {
    const onChange = vi.fn()
    render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        selectedPlanId={null}
        onChange={onChange}
        onSelectedPlanChange={vi.fn()}
        locked={false}
      />,
    )

    fireEvent.click(screen.getByLabelText('Recomendar el plan Esencial'))

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ recommended_plan_id: 'essential' }),
    )
  })

  it('disables maintenance for a punctual proposal and clears its selected plan', () => {
    const onChange = vi.fn()
    const onSelectedPlanChange = vi.fn()
    const { rerender } = render(
      <MaintenanceOfferEditor
        offer={DEFAULT_MAINTENANCE_OFFER}
        selectedPlanId="growth"
        onChange={onChange}
        onSelectedPlanChange={onSelectedPlanChange}
        locked={false}
      />,
    )

    fireEvent.click(screen.getByLabelText('Incluir mantenimiento en esta propuesta'))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
    expect(onSelectedPlanChange).toHaveBeenCalledWith(null)
    rerender(
      <MaintenanceOfferEditor
        offer={{ ...DEFAULT_MAINTENANCE_OFFER, enabled: false }}
        selectedPlanId={null}
        onChange={onChange}
        onSelectedPlanChange={onSelectedPlanChange}
        locked={false}
      />,
    )
    expect(screen.queryByLabelText('Título de mantenimiento')).toBeNull()
  })
})
