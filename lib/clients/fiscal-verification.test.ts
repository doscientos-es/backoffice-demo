import { beforeEach, describe, expect, it, vi } from 'vitest'

const { maybeSingle, validateSpanishFiscalIdentity } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  validateSpanishFiscalIdentity: vi.fn(),
}))

vi.mock('@/lib/aeat/nif-validation', () => ({ validateSpanishFiscalIdentity }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ maybeSingle }) }),
      }),
    }),
  }),
}))

import { ensureInvoiceRecipientVerified } from './fiscal-verification'

describe('ensureInvoiceRecipientVerified', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    validateSpanishFiscalIdentity.mockReset()
  })

  it('accepts a verified recipient regardless of when AEAT confirmed it', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { invoice_type: 'F1', client_id: 'client-1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          nif: 'ES B12345678',
          name: 'Acme S.L.',
          billing_address_country: 'ES',
          fiscal_verification_status: 'verified',
          fiscal_verified_nif: 'B12345678',
          fiscal_verified_name: 'Acme S.L.',
          fiscal_verified_at: '2020-01-01T00:00:00.000Z',
        },
        error: null,
      })

    await expect(ensureInvoiceRecipientVerified('invoice-1', 'member-1')).resolves.toBeUndefined()
    expect(validateSpanishFiscalIdentity).not.toHaveBeenCalled()
  })

  it('requires a new check when the saved identity no longer matches the client', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { invoice_type: 'F1', client_id: 'client-1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          nif: 'B12345678',
          name: 'Acme Renombrada S.L.',
          billing_address_country: 'ES',
          fiscal_verification_status: 'verified',
          fiscal_verified_nif: 'B12345678',
          fiscal_verified_name: 'Acme S.L.',
          fiscal_verified_at: '2026-08-31T00:00:00.000Z',
        },
        error: null,
      })

    await expect(ensureInvoiceRecipientVerified('invoice-1', 'member-1')).rejects.toThrow(
      'deben validarse con AEAT antes de regularizar una factura F1',
    )
    expect(validateSpanishFiscalIdentity).not.toHaveBeenCalled()
  })
})
