import { createHmac, timingSafeEqual } from 'node:crypto'

import type { LeadIntake } from './lead-intake'

export type CalWebhookPayload = {
  triggerEvent: string
  createdAt: string
  payload: {
    uid: string
    bookingId: number
    title: string
    startTime: string
    endTime: string
    attendees: Array<{
      email: string
      name: string
      timeZone: string
    }>
    organizer: {
      email: string
      name: string
    }
    additionalNotes?: string
    metadata?: Record<string, unknown>
  }
}

export function verifyCalSignature(
  secret: string,
  body: string,
  signature: string | null,
): boolean {
  if (!signature) return false
  const hmac = createHmac('sha256', secret)
  const digest = hmac.update(body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

function metadataText(
  metadata: Record<string, unknown> | undefined,
  key: string,
  maxLength: number,
): string | null {
  const value = metadata?.[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, maxLength)
  return trimmed || null
}

export function mapCalToLeadIntake(payload: CalWebhookPayload): LeadIntake {
  const { triggerEvent, payload: booking } = payload
  const guest = booking.attendees[0]
  const metadata = booking.metadata

  return {
    name: guest?.name || 'Guest',
    email: guest?.email || null,
    source: 'Cal.com',
    externalId: booking.uid,
    externalSource: 'Cal.com',
    mergeIntoLeadId: metadataText(metadata, 'leadId', 120),
    notes: `Meeting: ${booking.title}\nStatus: ${triggerEvent}\nNotes: ${booking.additionalNotes || 'none'}`,
    utm: {
      source: metadataText(metadata, 'lastUtmSource', 200),
      medium: metadataText(metadata, 'lastUtmMedium', 200),
      campaign: metadataText(metadata, 'lastUtmCampaign', 200),
      term: metadataText(metadata, 'lastUtmTerm', 200),
      content: metadataText(metadata, 'lastUtmContent', 200),
    },
    context: {
      eventId: metadataText(metadata, 'eventId', 120),
      visitorId: metadataText(metadata, 'visitorId', 120),
      conversionStep: metadataText(metadata, 'conversionStep', 120),
      landingPath: metadataText(metadata, 'landingPath', 500),
      landingRef: metadataText(metadata, 'landingRef', 200),
      referrer: metadataText(metadata, 'referrer', 500),
      firstLandingPath: metadataText(metadata, 'firstLandingPath', 500),
      firstReferrer: metadataText(metadata, 'firstReferrer', 500),
      firstUtmSource: metadataText(metadata, 'firstUtmSource', 200),
      firstUtmMedium: metadataText(metadata, 'firstUtmMedium', 200),
      firstUtmCampaign: metadataText(metadata, 'firstUtmCampaign', 200),
      firstUtmTerm: metadataText(metadata, 'firstUtmTerm', 200),
      firstUtmContent: metadataText(metadata, 'firstUtmContent', 200),
      lastLandingPath: metadataText(metadata, 'landingPath', 500),
      lastReferrer: metadataText(metadata, 'referrer', 500),
      lastUtmSource: metadataText(metadata, 'lastUtmSource', 200),
      lastUtmMedium: metadataText(metadata, 'lastUtmMedium', 200),
      lastUtmCampaign: metadataText(metadata, 'lastUtmCampaign', 200),
      lastUtmTerm: metadataText(metadata, 'lastUtmTerm', 200),
      lastUtmContent: metadataText(metadata, 'lastUtmContent', 200),
    },
    rawPayload: payload,
  }
}
