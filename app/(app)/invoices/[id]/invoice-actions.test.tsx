import { render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InvoiceActions } from './invoice-actions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/ui/form-feedback', () => ({
  FormFeedback: () => null,
  useFormFeedback: () => ({
    state: { status: 'idle' },
    setPending: vi.fn(),
    setSuccess: vi.fn(),
    setError: vi.fn(),
  }),
}))
vi.mock('@/components/ui/icon-button', () => ({
  IconButton: ({ label }: { label: string }) => <button aria-label={label} type="button" />,
}))
vi.mock('./invoice-issuance-action', () => ({
  InvoiceIssuanceAction: () => <button type="button">Emitir</button>,
}))
vi.mock('./invoice-payment-actions', () => ({
  InvoicePaymentActions: () => <button type="button">Registrar cobro</button>,
}))
vi.mock('./regularize-aeat-button', () => ({
  RegularizeAeatButton: () => <button type="button">Regularizar rechazo AEAT</button>,
}))
vi.mock('./send-aeat-button', () => ({
  SendAeatButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}))
vi.mock('./send-invoice-button', () => ({
  SendInvoiceButton: () => <button aria-label="Enviar email al cliente" type="button" />,
}))
vi.mock('./invoice-more-actions', () => ({
  InvoiceMoreActions: () => <button aria-label="Más acciones" type="button" />,
}))
vi.mock('./use-invoice-status-verification', () => ({
  useInvoiceStatusVerification: () => ({ challenge: null, verifyStatusChange: vi.fn() }),
}))

describe('InvoiceActions', () => {
  it('groups the icon-only actions separately from the primary action buttons', () => {
    const { container } = render(
      <InvoiceActions
        invoice={{
          id: 'invoice-1',
          status: 'issued',
          verifactu_status: 'error',
          verifactu_error: 'Error técnico',
          total: 100,
          amountPaid: 0,
        }}
      />,
    )

    const root = container.firstElementChild as HTMLDivElement
    const actionGroups = Array.from(root.children).filter(
      (child): child is HTMLDivElement =>
        child instanceof HTMLDivElement && child.classList.contains('justify-end'),
    )
    const [iconActions, primaryActions] = actionGroups

    if (!iconActions || !primaryActions) throw new Error('Missing invoice action groups')

    expect(within(iconActions).getByRole('button', { name: 'Descargar PDF' })).toBeTruthy()
    expect(
      within(iconActions).getByRole('button', { name: 'Enviar email al cliente' }),
    ).toBeTruthy()
    expect(within(iconActions).getByRole('button', { name: 'Más acciones' })).toBeTruthy()
    expect(within(primaryActions).getByRole('button', { name: 'Registrar cobro' })).toBeTruthy()
    expect(within(primaryActions).getByRole('button', { name: 'Reintentar envío' })).toBeTruthy()
    expect(
      within(primaryActions).queryByRole('button', { name: 'Regularizar rechazo AEAT' }),
    ).toBeNull()
  })

  it('labels a queued rejection recovery as an AEAT regularization', () => {
    const { getByRole, queryByRole } = render(
      <InvoiceActions
        invoice={{
          id: 'invoice-1',
          status: 'paid',
          verifactu_status: 'submitted',
          verifactu_error: null,
          is_regularization_pending: true,
          total: 100,
          amountPaid: 100,
        }}
      />,
    )

    expect(getByRole('button', { name: 'Enviar regularización a AEAT' })).toBeTruthy()
    expect(queryByRole('button', { name: 'Regularizar rechazo AEAT' })).toBeNull()
  })

  it('offers regularization instead of a normal resend after an AEAT rejection', () => {
    const { getByRole, queryByRole } = render(
      <InvoiceActions
        invoice={{
          id: 'invoice-1',
          status: 'paid',
          verifactu_status: 'rejected',
          verifactu_error: 'AEAT rechazó el registro',
          total: 100,
          amountPaid: 100,
        }}
      />,
    )

    expect(getByRole('button', { name: 'Regularizar rechazo AEAT' })).toBeTruthy()
    expect(queryByRole('button', { name: 'Enviar a AEAT' })).toBeNull()
  })
})
