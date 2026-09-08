import { describe, expect, it } from 'vitest'

import {
  formatDatedInteractionForAI,
  getCallInteractionDetails,
  groupResendInteractions,
  interactionBodyText,
  interactionDate,
} from './interaction-utils'

describe('groupResendInteractions', () => {
  it('groups the complete Resend lifecycle by email and retains the original content', () => {
    const result = groupResendInteractions([
      {
        id: 'delivered-1',
        type: 'email_delivered',
        resend_email_id: 'email-1',
        created_at: '2026-08-26T10:02:00.000Z',
      },
      {
        id: 'delivered-2',
        type: 'email_delivered',
        resend_email_id: 'email-1',
        created_at: '2026-08-26T10:01:00.000Z',
      },
      {
        id: 'sent-1',
        type: 'email_sent',
        resend_email_id: 'email-1',
        body: 'Contenido original',
        created_at: '2026-08-26T10:00:00.000Z',
      },
      { id: 'manual', type: 'email_sent', resend_email_id: null },
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      interaction: expect.objectContaining({ id: 'sent-1' }),
      latestInteraction: expect.objectContaining({ id: 'delivered-1' }),
      count: 3,
      statuses: ['email_sent', 'email_delivered'],
    })
    expect(result[1]).toEqual({
      interaction: expect.objectContaining({ id: 'manual' }),
      latestInteraction: expect.objectContaining({ id: 'manual' }),
      count: 1,
      statuses: [],
    })
  })
})

describe('interactionBodyText', () => {
  it('turns stored email HTML into safe text and keeps meaningful line breaks', () => {
    expect(
      interactionBodyText(
        '<p>Hola &amp; gracias</p><p>Primera línea<br>Segunda línea</p><script>bad()</script>',
      ),
    ).toBe('Hola & gracias\nPrimera línea\nSegunda línea')
  })

  it('keeps multiline plain text unchanged', () => {
    expect(interactionBodyText('Primera línea\nSegunda línea')).toBe('Primera línea\nSegunda línea')
  })
})

describe('call interaction dates', () => {
  it('uses the call date stored in metadata and otherwise keeps the audit timestamp', () => {
    const interaction = {
      type: 'call',
      subject: 'Llamada',
      body: null,
      created_at: '2026-08-17T10:00:00.000Z',
      payload: { call_date: '2026-08-10' },
    }

    expect(getCallInteractionDetails(interaction.payload).callDate).toBe('2026-08-10')
    expect(interactionDate(interaction)).toBe('2026-08-10')
    expect(interactionDate({ ...interaction, payload: {} })).toBe(interaction.created_at)
  })

  it("makes recent and old calls' elapsed time explicit when a reference date is provided", () => {
    const baseInteraction = {
      type: 'call',
      subject: 'Seguimiento',
      body: null,
      payload: {},
      created_at: '2026-08-23T10:00:00.000Z',
    }
    const referenceDate = new Date('2026-08-24T12:00:00.000Z')

    expect(formatDatedInteractionForAI(baseInteraction, referenceDate)).toContain(
      '2026-08-23 (ayer) | call',
    )
    expect(
      formatDatedInteractionForAI(
        { ...baseInteraction, created_at: '2026-06-24T10:00:00.000Z' },
        referenceDate,
      ),
    ).toContain('2026-06-24 (hace aprox. 2 meses (61 días)) | call')
  })
})
