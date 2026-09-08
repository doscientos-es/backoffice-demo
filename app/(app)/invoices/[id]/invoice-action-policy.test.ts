import { describe, expect, it } from 'vitest'

import { aeatDeliveryLabel, getInvoiceActionPolicy } from './invoice-action-policy'

const invoice = {
  id: 'invoice-1',
  status: 'draft',
  verifactu_status: 'pending',
  verifactu_error: null,
  total: 100,
  amountPaid: 0,
}

describe('getInvoiceActionPolicy', () => {
  it('only exposes draft-safe actions before issuance', () => {
    expect(getInvoiceActionPolicy(invoice)).toMatchObject({
      canEdit: true,
      canIssue: true,
      canRecordPayment: false,
      canRectify: false,
    })
  })

  it('protects AEAT-accepted invoices from deletion and enables rectification', () => {
    expect(
      getInvoiceActionPolicy({ ...invoice, status: 'paid', verifactu_status: 'accepted' }),
    ).toMatchObject({ canDelete: false, canRectify: true, canRevertPayment: true })
  })

  it('keeps a definitive AEAT rejection out of the normal retry flow', () => {
    expect(aeatDeliveryLabel('pending')).toBe('Enviar a AEAT')
    expect(aeatDeliveryLabel('error')).toBe('Reintentar envío')
    expect(aeatDeliveryLabel('rejected')).toBe('Regularizar AEAT')
    expect(
      getInvoiceActionPolicy({ ...invoice, status: 'paid', verifactu_status: 'rejected' }),
    ).toMatchObject({
      hasFiscalProblem: true,
      shouldSendToAeat: false,
      shouldRegularizeAeat: true,
    })
  })

  it('regularizes terminal delivery errors instead of offering an impossible retry', () => {
    expect(
      getInvoiceActionPolicy({
        ...invoice,
        status: 'issued',
        verifactu_status: 'error',
        fiscal_delivery_state: 'terminal_error',
      }),
    ).toMatchObject({ shouldSendToAeat: false, shouldRegularizeAeat: true })
  })
})
