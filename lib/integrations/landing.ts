import { z } from 'zod'

import { type LeadIntake, parseBudgetFloor } from '@/lib/integrations/lead-intake'
import { optionalEmail, optionalText, requiredText } from '@/lib/schemas/common'

/**
 * Validation schema for the public landing contact form.
 *
 * Reuses the shared primitives so empty optional inputs ("") collapse to
 * `undefined` exactly like the rest of the app's form schemas. Every text
 * field is length-capped to keep the public endpoint cheap to abuse.
 */
export const LandingLeadInput = z.object({
  name: requiredText(160, 'El nombre es obligatorio'),
  email: optionalEmail,
  phone: optionalText(40),
  company: optionalText(160),
  solutionType: optionalText(120),
  message: optionalText(4000),
  budget: optionalText(80),
  companySize: optionalText(80),
  urgency: optionalText(80),
  // Attribution (the landing forwards these from the URL / first-touch cookie).
  utm_source: optionalText(200),
  utm_medium: optionalText(200),
  utm_campaign: optionalText(200),
  utm_term: optionalText(200),
  utm_content: optionalText(200),
  referrer: optionalText(500),
  language: optionalText(16),
  event_id: optionalText(120),
  visitor_id: optionalText(120),
  internal_traffic: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),
  meta_fbc: optionalText(300),
  meta_fbp: optionalText(300),
  meta_fbclid: optionalText(500),
  conversion_step: optionalText(120),
  landing_path: optionalText(500),
  landing_ref: optionalText(200),
  landing_subject: optionalText(300),
  resource: optionalText(200),
  calculator_cost: optionalText(80),
  calculator_hours: optionalText(80),
  first_landing_path: optionalText(500),
  first_referrer: optionalText(500),
  first_utm_source: optionalText(200),
  first_utm_medium: optionalText(200),
  first_utm_campaign: optionalText(200),
  first_utm_term: optionalText(200),
  first_utm_content: optionalText(200),
  last_landing_path: optionalText(500),
  last_referrer: optionalText(500),
  last_utm_source: optionalText(200),
  last_utm_medium: optionalText(200),
  last_utm_campaign: optionalText(200),
  last_utm_term: optionalText(200),
  last_utm_content: optionalText(200),
  /**
   * Optional client-generated idempotency key (e.g. a UUID stored in the form
   * session). When present, double submits dedupe via ingestLead() instead of
   * creating duplicate leads. When absent, every submit creates a new lead.
   */
  dedupeKey: optionalText(120),
  /** Honeypot: must stay empty. Real users never see it; bots fill it. */
  website: optionalText(200),
})

export type LandingLeadInputType = z.infer<typeof LandingLeadInput>

/** Minimal device classification from the User-Agent header. */
function deviceFromUserAgent(ua: string | null): string | null {
  if (!ua) return null
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop'
}

/**
 * Translate a validated landing form submission into the generic LeadIntake
 * shape consumed by the storage layer. Keeps the endpoint thin and the mapping
 * unit-testable in isolation (mirrors the Meta / Recurrev adapters).
 */
export function mapLandingToIntake(
  input: LandingLeadInputType,
  ctx?: { ip?: string | null; userAgent?: string | null },
): LeadIntake {
  const notesParts = [
    input.message ?? null,
    input.companySize ? `Tamaño de empresa: ${input.companySize}` : null,
    input.solutionType ? `Necesidad: ${input.solutionType}` : null,
    input.urgency ? `Urgencia: ${input.urgency}` : null,
    input.budget ? `Presupuesto: ${input.budget}` : null,
    input.resource ? `Recurso solicitado: ${input.resource}` : null,
  ].filter((v): v is string => Boolean(v))

  const dedupeKey = input.dedupeKey ?? null
  const ua = ctx?.userAgent ?? null

  return {
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company: input.company ?? null,
    notes: notesParts.length ? notesParts.join('\n') : null,
    estimatedValue: parseBudgetFloor(input.budget),
    companySize: input.companySize ?? null,
    solutionType: input.solutionType ?? null,
    urgency: input.urgency ?? null,
    source: 'Landing',
    externalId: dedupeKey,
    externalSource: dedupeKey ? 'Landing' : null,
    utm: {
      source: input.utm_source ?? null,
      medium: input.utm_medium ?? null,
      campaign: input.utm_campaign ?? null,
      term: input.utm_term ?? null,
      content: input.utm_content ?? null,
    },
    context: {
      eventId: input.event_id ?? null,
      visitorId: input.visitor_id ?? null,
      internalTraffic: input.internal_traffic === true,
      marketingConsent: input.marketing_consent === true,
      metaFbc: input.meta_fbc ?? null,
      metaFbp: input.meta_fbp ?? null,
      metaFbclid: input.meta_fbclid ?? null,
      conversionStep: input.conversion_step ?? null,
      referrer: input.referrer ?? null,
      ip: ctx?.ip ?? null,
      device: deviceFromUserAgent(ua),
      browser: ua,
      language: input.language ?? null,
      landingPath: input.landing_path ?? null,
      landingRef: input.landing_ref ?? null,
      landingSubject: input.landing_subject ?? null,
      resourceSlug: input.resource ?? null,
      calculatorCost: input.calculator_cost ?? null,
      calculatorHours: input.calculator_hours ?? null,
      firstLandingPath: input.first_landing_path ?? null,
      firstReferrer: input.first_referrer ?? null,
      firstUtmSource: input.first_utm_source ?? null,
      firstUtmMedium: input.first_utm_medium ?? null,
      firstUtmCampaign: input.first_utm_campaign ?? null,
      firstUtmTerm: input.first_utm_term ?? null,
      firstUtmContent: input.first_utm_content ?? null,
      lastLandingPath: input.last_landing_path ?? null,
      lastReferrer: input.last_referrer ?? null,
      lastUtmSource: input.last_utm_source ?? null,
      lastUtmMedium: input.last_utm_medium ?? null,
      lastUtmCampaign: input.last_utm_campaign ?? null,
      lastUtmTerm: input.last_utm_term ?? null,
      lastUtmContent: input.last_utm_content ?? null,
    },
    rawPayload: input,
  }
}
