import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClient, createRedsysPayment, insertPayment } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createRedsysPayment: vi.fn(),
  insertPayment: vi.fn(),
}))

vi.mock('@/lib/email/app-url', () => ({ externalAppUrl: () => 'https://app.example.test' }))
vi.mock('@/lib/env', () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://app.example.test' },
  serverEnv: () => ({
    REDSYS_MERCHANT_CODE: 'merchant',
    REDSYS_TERMINAL: '1',
    REDSYS_CURRENCY: '978',
  }),
}))
vi.mock('@/lib/integrations/redsys', () => ({
  createRedsysPayment,
  getRedsysUrl: () => 'https://redsys.example.test',
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { initiatePayment } from './actions'

describe('initiatePayment', () => {
  beforeEach(() => {
    insertPayment.mockReset()
    createRedsysPayment.mockReset()
    insertPayment.mockReturnValue({
      select: () => ({ single: async () => ({ data: { redsys_order: 'order-1' }, error: null }) }),
    })
    createRedsysPayment.mockReturnValue({
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters: 'params',
      Ds_Signature: 'signature',
    })
    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'invoices') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'invoice-1', status: 'issued', total: 121, number: 1 },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {
          select: () => ({ eq: () => ({ eq: async () => ({ data: [{ amount: 21 }] }) }) }),
          insert: insertPayment,
        }
      },
    })
  })

  it('charges the complete outstanding balance instead of an invoice deposit', async () => {
    await expect(initiatePayment('invoice-1', 'portal-token')).resolves.toMatchObject({ ok: true })

    expect(insertPayment).toHaveBeenCalledWith({ invoice_id: 'invoice-1', amount: 100 })
    expect(createRedsysPayment).toHaveBeenCalledWith(
      expect.objectContaining({ Ds_Merchant_Amount: '10000' }),
    )
  })
})