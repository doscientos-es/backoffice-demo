import { describe, expect, it } from 'vitest'

import { type CalWebhookPayload, mapCalToLeadIntake } from './cal'

const booking: CalWebhookPayload = {
  triggerEvent: 'BOOKING_CREATED',
  createdAt: '2026-08-26T10:00:00.000Z',
  payload: {
    uid: 'booking-1',
    bookingId: 1,
    title: 'Diagnóstico',
    startTime: '2026-08-27T10:00:00.000Z',
    endTime: '2026-08-27T10:30:00.000Z',
    attendees: [{ name: 'Ana García', email: 'ana@example.com', timeZone: 'Europe/Madrid' }],
    organizer: { name: 'doscientos', email: 'hola@example.com' },
    metadata: {
      eventId: 'event-1',
      visitorId: 'visitor-1',
      conversionStep: 'calendar_booking',
      landingPath: '/',
      landingRef: 'home-hero',
      firstUtmSource: 'google',
      firstUtmMedium: 'cpc',
      firstUtmCampaign: 'summer',
      lastUtmSource: 'google',
      lastUtmMedium: 'cpc',
      lastUtmCampaign: 'summer',
    },
  },
}

describe('mapCalToLeadIntake', () => {
  it('restores direct-booking attribution from Cal metadata', () => {
    const intake = mapCalToLeadIntake(booking)

    expect(intake.utm).toMatchObject({ source: 'google', medium: 'cpc', campaign: 'summer' })
    expect(intake.context).toMatchObject({
      eventId: 'event-1',
      visitorId: 'visitor-1',
      conversionStep: 'calendar_booking',
      landingPath: '/',
      landingRef: 'home-hero',
      firstUtmCampaign: 'summer',
    })
  })
})
