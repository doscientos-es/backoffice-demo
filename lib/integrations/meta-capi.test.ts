import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, serverEnv } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  serverEnv: vi.fn(() => ({
    META_PIXEL_ID: '913006054543123',
    META_CAPI_ACCESS_TOKEN: 'test-token',
  })),
}))

vi.mock('@/lib/env', () => ({ serverEnv }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}))

import { pushMetaQualifiedLeadStage } from './meta-capi'

describe('Meta Qualified Leads CAPI', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ events_received: 1 }) })
    vi.stubGlobal('fetch', fetchMock)
  })

  it("sends the required CRM payload and preserves Meta's lead id as a string", async () => {
    await pushMetaQualifiedLeadStage({
      leadId: 'crm-uuid',
      status: 'qualified',
      email: 'Lead@Example.com ',
      phone: '+34 600 111 222',
      externalSource: 'Anuncios Meta',
      externalId: '12345678901234567',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v26.0/913006054543123/events?access_token=test-token',
      expect.objectContaining({ method: 'POST' }),
    )
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(request.body as string)).toMatchObject({
      data: [
        {
          event_name: 'Lead',
          event_id: 'lead-crm-uuid-qualified',
          event_time: expect.any(Number),
          action_source: 'system_generated',
          custom_data: {
            event_source: 'crm',
            lead_event_source: 'doscientos-backoffice',
            lead_status: 'qualified',
            currency: 'EUR',
          },
          user_data: {
            lead_id: '12345678901234567',
            em: ['9fbdefe2837a03c9225be80e741f316f4d174d1732b719b6abb6477efc1ae9d2'],
          },
        },
      ],
    })
  })

  it('does not send a non-Meta external id as a lead_id', async () => {
    await pushMetaQualifiedLeadStage({
      leadId: 'crm-uuid',
      status: 'contacted',
      phone: '+34600111222',
      externalSource: 'Cal.com',
      externalId: 'booking-id',
    })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(request.body as string)
    expect(body.data[0].user_data).not.toHaveProperty('lead_id')
    expect(body.data[0].user_data.ph).toEqual([
      '67f01a2b0e2c34277df586b5cc6e35a5f232494e64dc33b5f75f80bf568914f1',
    ])
  })
})
