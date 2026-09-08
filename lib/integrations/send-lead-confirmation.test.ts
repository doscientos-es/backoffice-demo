import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insertedInteractions, sendEmail } = vi.hoisted(() => ({
  insertedInteractions: [] as Record<string, unknown>[],
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/email/render', () => ({
  renderEmail: vi.fn().mockResolvedValue('<html><body>Confirmación</body></html>'),
}))
vi.mock('@/lib/email/resend', () => ({ sendEmail }))
vi.mock('@/lib/env', () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://app.doscientos.es' },
}))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ warn: vi.fn() }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        insertedInteractions.push({ table, ...row })
        return { error: null }
      },
    }),
  }),
}))

import { sendLeadConfirmation, shouldSendLeadConfirmation } from './send-lead-confirmation'

const baseInput = {
  leadId: 'lead-1',
  leadName: 'María López',
  leadEmail: 'maria@example.com',
  leadSource: 'Landing',
}

describe('sendLeadConfirmation', () => {
  beforeEach(() => {
    insertedInteractions.length = 0
    sendEmail.mockReset().mockResolvedValue({ id: 'resend-1', mocked: false })
  })

  it.each(['Landing', 'landing', 'Anuncios Meta', 'meta'])(
    'sends confirmations for automatic source %s',
    async (leadSource) => {
      await sendLeadConfirmation({ ...baseInput, leadSource })

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAlias: 'hola',
          to: 'maria@example.com',
          replyTo: 'hola@doscientos.es',
          subject: 'María, hemos recibido tu solicitud',
          tags: { lead_id: 'lead-1', kind: 'lead_confirmation' },
        }),
      )
      expect(insertedInteractions).toContainEqual(
        expect.objectContaining({
          table: 'lead_interactions',
          lead_id: 'lead-1',
          type: 'email_sent',
          resend_email_id: 'resend-1',
          payload: expect.objectContaining({ source: 'automatic_lead_confirmation' }),
        }),
      )
    },
  )

  it('skips manual, Cal.com, internal and email-less leads', () => {
    expect(shouldSendLeadConfirmation({ ...baseInput, leadSource: 'Cal.com' })).toBe(false)
    expect(shouldSendLeadConfirmation({ ...baseInput, leadSource: 'Referencia' })).toBe(false)
    expect(shouldSendLeadConfirmation({ ...baseInput, internalTraffic: true })).toBe(false)
    expect(shouldSendLeadConfirmation({ ...baseInput, leadEmail: null })).toBe(false)
  })
})
