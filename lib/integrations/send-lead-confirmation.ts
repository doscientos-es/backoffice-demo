import { LeadConfirmationEmail } from '@/components/email/lead-confirmation-email'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { normalizeLeadSource } from '@/lib/leads/constants'
import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

import { selectLeadResource } from './lead-resources'

const AUTOMATIC_SOURCES = new Set(['Landing', 'Anuncios Meta'])
const log = scopedLogger('send-lead-confirmation')

export type SendLeadConfirmationInput = {
  leadId: string
  leadName: string
  leadEmail?: string | null
  leadSource: string
  internalTraffic?: boolean
  landingRef?: string | null
  landingSubject?: string | null
  resourceSlug?: string | null
  calculatorCost?: string | null
  calculatorHours?: string | null
}

export function shouldSendLeadConfirmation(input: SendLeadConfirmationInput): boolean {
  const source = normalizeLeadSource(input.leadSource)
  return Boolean(
    input.leadEmail && !input.internalTraffic && source && AUTOMATIC_SOURCES.has(source),
  )
}

/** Sends the acknowledgement without counting it as the first commercial contact. */
export async function sendLeadConfirmation(input: SendLeadConfirmationInput): Promise<void> {
  if (!shouldSendLeadConfirmation(input)) return

  const email = input.leadEmail as string
  const firstName = input.leadName.trim().split(/\s+/)[0] || input.leadName
  const subject = `${firstName}, hemos recibido tu solicitud`
  const resource = selectLeadResource({
    resourceSlug: input.resourceSlug,
    landingRef: input.landingRef,
    landingSubject: input.landingSubject,
    calculatorCost: input.calculatorCost,
    calculatorHours: input.calculatorHours,
  })
  const html = await renderEmail(
    LeadConfirmationEmail({
      leadName: input.leadName,
      appUrl: externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL),
      resource,
      calculatorCost: input.calculatorCost,
      calculatorHours: input.calculatorHours,
    }),
  )
  const sent = await sendEmail({
    fromName: 'doscientos',
    fromAlias: 'hola',
    to: email,
    replyTo: 'hola@doscientos.es',
    subject,
    html,
    tags: { lead_id: input.leadId, kind: 'lead_confirmation' },
  })

  const { error } = await createAdminClient()
    .from('lead_interactions')
    .insert({
      lead_id: input.leadId,
      type: 'email_sent',
      subject,
      body: html,
      resend_email_id: sent.id,
      payload: {
        source: 'automatic_lead_confirmation',
        lead_source: normalizeLeadSource(input.leadSource),
        resource_slug: resource.slug,
        mocked: sent.mocked,
      },
    })
  if (error) {
    log.warn({ err: error, leadId: input.leadId }, 'lead confirmation interaction failed')
  }
}
