import { describe, expect, it } from 'vitest'

import {
  AssignLeadOwnerInput,
  CALL_OUTCOMES,
  ConvertLeadInput,
  CreateLeadInput,
  DeleteLeadInteractionInput,
  LeadStatus,
  LogCallInput,
  LogEmailInput,
  LogNoteInput,
  LogWhatsAppInput,
  MOM_TEST_SIGNALS,
  SendEmailToLeadInput,
  UpdateLeadCallInput,
  UpdateLeadInput,
  UpdateLeadMomTestInput,
  UpdateLeadStatusInput,
} from '@/lib/schemas/lead'

const uuid = '11111111-1111-1111-1111-111111111111'

describe('LeadStatus', () => {
  it('accepts known states and rejects unknown', () => {
    expect(LeadStatus.parse('new')).toBe('new')
    expect(LeadStatus.safeParse('nope').success).toBe(false)
  })
})

describe('CreateLeadInput', () => {
  it('requires a name and coerces empty optionals', () => {
    const out = CreateLeadInput.parse({ name: 'Acme', email: '', phone: '' })
    expect(out.name).toBe('Acme')
    // optionalEmail collapses "" to undefined; optionalText (phone) keeps "".
    expect(out.email).toBeUndefined()
    expect(out.phone).toBe('')
  })
  it('rejects empty name and invalid email', () => {
    expect(CreateLeadInput.safeParse({ name: '' }).success).toBe(false)
    expect(CreateLeadInput.safeParse({ name: 'X', email: 'bad' }).success).toBe(false)
  })
  it('validates estimated_value bounds', () => {
    expect(CreateLeadInput.safeParse({ name: 'X', estimated_value: -1 }).success).toBe(false)
    expect(CreateLeadInput.parse({ name: 'X', estimated_value: 100 }).estimated_value).toBe(100)
  })
})

describe('UpdateLeadInput', () => {
  it('requires a valid id and optimistic-lock version', () => {
    expect(UpdateLeadInput.safeParse({ name: 'X' }).success).toBe(false)
    expect(UpdateLeadInput.safeParse({ id: uuid, name: 'X' }).success).toBe(false)
    expect(UpdateLeadInput.parse({ id: uuid, name: 'X', expected_version: 1 }).id).toBe(uuid)
  })
})

describe('ConvertLeadInput', () => {
  it('requires fiscal fields', () => {
    expect(
      ConvertLeadInput.safeParse({ leadId: uuid, name: 'X', nif: '', billing_address: '' }).success,
    ).toBe(false)
    expect(
      ConvertLeadInput.parse({
        leadId: uuid,
        name: 'X',
        nif: 'B12345678',
        billing_address: 'C/ Falsa 1',
      }).nif,
    ).toBe('B12345678')
  })
  it('carries an optional alias through to the client label', () => {
    expect(
      ConvertLeadInput.parse({
        leadId: uuid,
        name: 'X',
        alias: 'Pepito',
        nif: 'B12345678',
        billing_address: 'C/ Falsa 1',
      }).alias,
    ).toBe('Pepito')
  })
})

describe('UpdateLeadStatusInput refinements', () => {
  it('forbids a reason for non-closure states', () => {
    expect(
      UpdateLeadStatusInput.safeParse({ leadId: uuid, status: 'new', lostReason: 'x' }).success,
    ).toBe(false)
  })
  it('requires a reason for closure states', () => {
    expect(UpdateLeadStatusInput.safeParse({ leadId: uuid, status: 'lost' }).success).toBe(false)
    expect(
      UpdateLeadStatusInput.safeParse({ leadId: uuid, status: 'lost', lostReason: 'Caro' }).success,
    ).toBe(true)
    expect(
      UpdateLeadStatusInput.safeParse({ leadId: uuid, status: 'not_interested', lostReason: 'x' })
        .success,
    ).toBe(true)
  })
  it('allows non-closure states without a reason', () => {
    expect(UpdateLeadStatusInput.safeParse({ leadId: uuid, status: 'won' }).success).toBe(true)
  })
})

describe('UpdateLeadMomTestInput', () => {
  it('supports the five Mom Test criteria with a tri-state value', () => {
    expect(MOM_TEST_SIGNALS).toEqual([
      'real_problem',
      'aware_problem',
      'tried_solutions',
      'decision_power_or_budget',
      'accessible',
    ])
    expect(
      UpdateLeadMomTestInput.parse({
        leadId: uuid,
        signal: 'accessible',
        value: null,
      }).value,
    ).toBeNull()
  })
})

describe('LogCallInput', () => {
  it('requires notes or transcript when the call was connected', () => {
    expect(LogCallInput.safeParse({ leadId: uuid }).success).toBe(false)
    expect(LogCallInput.safeParse({ leadId: uuid, notes: 'Hablamos' }).success).toBe(true)
    expect(LogCallInput.safeParse({ leadId: uuid, transcript: '...' }).success).toBe(true)
    expect(LogCallInput.safeParse({ leadId: uuid, outcome: 'connected' }).success).toBe(false)
  })
  it('allows unanswered outcomes without notes or transcript', () => {
    expect(LogCallInput.safeParse({ leadId: uuid, outcome: 'no_answer' }).success).toBe(true)
    expect(LogCallInput.safeParse({ leadId: uuid, outcome: 'voicemail' }).success).toBe(true)
    expect(LogCallInput.safeParse({ leadId: uuid, outcome: 'busy' }).success).toBe(true)
    expect(LogCallInput.safeParse({ leadId: uuid, outcome: 'wrong_number' }).success).toBe(true)
  })
  it('coerces duration and validates outcome', () => {
    const out = LogCallInput.parse({
      leadId: uuid,
      notes: 'x',
      durationMinutes: '12',
      callDate: '2026-08-10',
    })
    expect(out.durationMinutes).toBe(12)
    expect(out.callDate).toBe('2026-08-10')
    expect(CALL_OUTCOMES).toContain('voicemail')
  })
  it('accepts past call dates and rejects invalid or future dates', () => {
    expect(
      LogCallInput.safeParse({ leadId: uuid, notes: 'x', callDate: '2026-08-10' }).success,
    ).toBe(true)
    expect(
      LogCallInput.safeParse({ leadId: uuid, notes: 'x', callDate: '2026-02-30' }).success,
    ).toBe(false)
    expect(
      LogCallInput.safeParse({ leadId: uuid, notes: 'x', callDate: '9999-01-01' }).success,
    ).toBe(false)
  })
  it('defaults the call date to today when legacy callers omit it', () => {
    const result = LogCallInput.parse({ leadId: uuid, notes: 'x' })
    expect(result.callDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('manual communication inputs', () => {
  it('validates email log shape', () => {
    expect(
      LogEmailInput.safeParse({ leadId: uuid, direction: 'outgoing', subject: 'Hi' }).success,
    ).toBe(true)
    expect(LogEmailInput.safeParse({ leadId: uuid, direction: 'x', subject: 'Hi' }).success).toBe(
      false,
    )
  })
  it('requires note content', () => {
    expect(LogNoteInput.safeParse({ leadId: uuid, content: '' }).success).toBe(false)
    expect(LogNoteInput.safeParse({ leadId: uuid, content: 'ok' }).success).toBe(true)
  })
  it('requires a non-empty WhatsApp message', () => {
    expect(LogWhatsAppInput.safeParse({ leadId: uuid, content: '' }).success).toBe(false)
    expect(LogWhatsAppInput.safeParse({ leadId: uuid, content: 'Hola' }).success).toBe(true)
  })
})

describe('manual interaction edits', () => {
  it('validates changes to a historic call without allowing a future date', () => {
    expect(
      UpdateLeadCallInput.safeParse({
        interactionId: uuid,
        leadId: uuid,
        notes: 'Rectificamos el resultado.',
        callDate: '2026-08-10',
      }).success,
    ).toBe(true)
    expect(
      UpdateLeadCallInput.safeParse({
        interactionId: uuid,
        leadId: uuid,
        notes: 'x',
        callDate: '9999-01-01',
      }).success,
    ).toBe(false)
  })

  it('requires valid ids to delete an interaction', () => {
    expect(
      DeleteLeadInteractionInput.safeParse({ interactionId: uuid, leadId: uuid }).success,
    ).toBe(true)
    expect(
      DeleteLeadInteractionInput.safeParse({ interactionId: 'bad', leadId: uuid }).success,
    ).toBe(false)
  })
})

describe('SendEmailToLeadInput / AssignLeadOwnerInput', () => {
  it('applies includeSignature default and requires recipient', () => {
    const out = SendEmailToLeadInput.parse({
      leadId: uuid,
      subject: 'S',
      bodyHtml: '<p>x</p>',
      to: 'a@b.com',
    })
    expect(out.includeSignature).toBe(true)
  })
  it('coerces empty assignee to null', () => {
    expect(AssignLeadOwnerInput.parse({ leadId: uuid, assigneeId: '' }).assigneeId).toBeNull()
  })
})
