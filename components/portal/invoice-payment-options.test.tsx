import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./redsys-payment-button', () => ({
  RedsysPaymentButton: () => <button type="button">Pagar con Tarjeta o Bizum</button>,
}))

import { InvoicePaymentOptions } from './invoice-payment-options'

describe('InvoicePaymentOptions', () => {
  it('shows the integrated gateway alongside copyable transfer details', () => {
    render(
      <InvoicePaymentOptions
        invoiceId="invoice-1"
        token="portal-token"
        total={121}
        amountPaid={21}
        invoiceNumber="FAC-2026-001"
        companyName="Doscientos S.L."
        iban="ES12 3456 7890 1234 5678 9012"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Elige cómo pagar' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Tarjeta o Bizum' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Pagar con Tarjeta o Bizum' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Transferencia bancaria' })).toBeDefined()
    expect(screen.getByText('ES12 3456 7890 1234 5678 9012')).toBeDefined()
    expect(screen.getByText('Factura FAC-2026-001')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copiar IBAN' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copiar todos los datos de la transferencia' })).toBeDefined()
  })

  it('keeps the gateway available when no IBAN has been configured', () => {
    render(
      <InvoicePaymentOptions
        invoiceId="invoice-1"
        token="portal-token"
        total={100}
        amountPaid={0}
        invoiceNumber="FAC-2026-001"
        companyName={null}
        iban={null}
      />,
    )

    expect(screen.getByRole('button', { name: 'Pagar con Tarjeta o Bizum' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Transferencia bancaria' })).toBeNull()
  })
})