import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/p/invoice/[token]/actions', () => ({ initiatePayment: vi.fn() }))

import { initiatePayment } from '@/app/p/invoice/[token]/actions'

import { RedsysPaymentButton } from './redsys-payment-button'

describe('RedsysPaymentButton', () => {
  it('charges the remaining balance without offering a deposit option', async () => {
    vi.mocked(initiatePayment).mockImplementation(() => new Promise(() => undefined))
    render(<RedsysPaymentButton invoiceId="invoice-1" token="portal-token" total={121} amountPaid={21} />)

    const button = screen.getByRole('button', { name: /Pagar 100,00.*Tarjeta o Bizum/ })
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByText(/señal/i)).toBeNull()

    fireEvent.click(button)

    await waitFor(() => expect(initiatePayment).toHaveBeenCalledWith('invoice-1', 'portal-token'))
  })
})