import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./proposal-payment-button', () => ({
  ProposalPaymentButton: () => <button type="button">Pagar primer plazo</button>,
}))

import { ProposalPaymentOptions } from './proposal-payment-options'

describe('ProposalPaymentOptions', () => {
  it('offers the agreed first payment by gateway or transfer with copy actions', () => {
    render(
      <ProposalPaymentOptions
        proposalId="proposal-1"
        token="portal-token"
        proposalNumber="P-2026-001"
        initialPaymentPercentage={50}
        depositAmount={605}
        companyName="Doscientos S.L."
        iban="ES12 3456 7890 1234 5678 9012"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Realiza el primer pago' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Tarjeta o Bizum' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Pagar primer plazo' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Transferencia bancaria' })).toBeDefined()
    expect(screen.getByText('Propuesta P-2026-001')).toBeDefined()
    expect(screen.getAllByText(/605,00/)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Copiar IBAN' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copiar todos los datos de la transferencia' })).toBeDefined()
  })

  it('keeps the integrated payment available without configured transfer details', () => {
    render(
      <ProposalPaymentOptions
        proposalId="proposal-1"
        token="portal-token"
        proposalNumber="P-2026-001"
        initialPaymentPercentage={50}
        depositAmount={605}
        companyName={null}
        iban={null}
      />,
    )

    expect(screen.getByRole('button', { name: 'Pagar primer plazo' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Transferencia bancaria' })).toBeNull()
  })
})
