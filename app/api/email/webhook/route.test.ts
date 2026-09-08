import { createHmac } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { WEBHOOK_SECRET, state } = vi.hoisted(() => {
  const webhookSecret = `whsec_${Buffer.from('resend-webhook-test-key').toString('base64')}`
  const maybeSingle = vi.fn()
  const upsert = vi.fn()
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        limit: () => ({ maybeSingle }),
      }),
      ilike: () => ({
        is: () => ({
          limit: () => ({ maybeSingle }),
        }),
      }),
    }),
    upsert,
  }))

  return { WEBHOOK_SECRET: webhookSecret, state: { from, maybeSingle, upsert } }
})

vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: state.from }),
}))

import { POST } from './route'

function signedRequest(body: string, id = 'msg_123') {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const key = Buffer.from(WEBHOOK_SECRET.slice('whsec_'.length), 'base64')
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')

  return new Request('http://localhost/api/email/webhook', {
    method: 'POST',
    body,
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
  }) as never
}

describe('POST /api/email/webhook', () => {
  beforeEach(() => {
    state.from.mockClear()
    state.maybeSingle.mockResolvedValue({ data: { lead_id: 'lead-1', client_id: null } })
    state.upsert.mockReset()
    state.upsert.mockResolvedValue({ error: null })
  })

  it.each([
    ['email.sent', 'email_sent'],
    ['email.scheduled', 'email_scheduled'],
    ['email.delivered', 'email_delivered'],
    ['email.delivery_delayed', 'email_delivery_delayed'],
    ['email.failed', 'email_failed'],
    ['email.opened', 'email_opened'],
    ['email.clicked', 'email_clicked'],
    ['email.bounced', 'email_bounced'],
    ['email.complained', 'email_complained'],
    ['email.suppressed', 'email_suppressed'],
    ['email.received', 'email_received'],
  ])('records %s as %s', async (eventType, interactionType) => {
    const body = JSON.stringify({
      type: eventType,
      data: { email_id: 'email-1', subject: 'Seguimiento' },
    })

    const response = await POST(signedRequest(body))

    expect(response.status).toBe(200)
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: 'lead-1',
        resend_email_id: 'email-1',
        resend_webhook_id: 'msg_123',
        type: interactionType,
      }),
      { ignoreDuplicates: true, onConflict: 'resend_webhook_id' },
    )
  })

  it('links an incoming email to the lead with the matching sender address', async () => {
    state.maybeSingle
      .mockResolvedValueOnce({ data: { lead_id: null, client_id: null } })
      .mockResolvedValueOnce({ data: { id: 'lead-from-sender' }, error: null })
    const body = JSON.stringify({
      type: 'email.received',
      data: {
        email_id: 'email-incoming',
        from: 'Toni Planells <toni@example.com>',
        subject: 'Consulta',
      },
    })

    const response = await POST(signedRequest(body))

    expect(response.status).toBe(200)
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ lead_id: 'lead-from-sender', type: 'email_received' }),
      expect.anything(),
    )
  })

  it('rejects an invalid signature', async () => {
    const response = await POST(
      new Request('http://localhost/api/email/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'email-1' } }),
        headers: {
          'svix-id': 'msg_123',
          'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
          'svix-signature': 'v1,invalid',
        },
      }) as never,
    )

    expect(response.status).toBe(401)
    expect(state.upsert).not.toHaveBeenCalled()
  })
})
