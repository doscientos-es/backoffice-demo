import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from '@/lib/proposals/maintenance'

import { ProposalMaintenanceOptions } from './proposal-maintenance-options'

const { refresh, selectProposalMaintenance } = vi.hoisted(() => ({
  refresh: vi.fn(),
  selectProposalMaintenance: vi.fn(async () => ({ ok: true })),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('./actions', () => ({ selectProposalMaintenance }))

describe('ProposalMaintenanceOptions', () => {
  it('explains the optional choice and lets the client select one coverage plan', async () => {
    render(
      <ProposalMaintenanceOptions
        token={'a'.repeat(48)}
        offer={DEFAULT_MAINTENANCE_OFFER}
        selectedPlanId={null}
        disabled={false}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Elige la cobertura que prefieras' })).toBeDefined()
    const growthPlan = screen.getByRole('heading', { name: 'Crecimiento' }).closest('article')
    expect(within(growthPlan!).getByText('Recomendado')).toBeDefined()
    expect(screen.getAllByText('Incluye')).toHaveLength(DEFAULT_MAINTENANCE_OFFER.plans.length)
    expect(screen.getAllByText('No incluye')).toHaveLength(DEFAULT_MAINTENANCE_OFFER.plans.length)

    const essentialPlan = screen.getByRole('heading', { name: 'Esencial' }).closest('article')
    fireEvent.click(within(essentialPlan!).getByRole('button', { name: 'Elegir este plan' }))

    await waitFor(() => {
      expect(selectProposalMaintenance).toHaveBeenCalledWith('a'.repeat(48), 'essential')
    })
    expect(
      screen.getByText('Has elegido Esencial. Puedes cambiarlo o quitarlo antes de confirmar.'),
    ).toBeDefined()
    expect(refresh).toHaveBeenCalled()
  })
})
