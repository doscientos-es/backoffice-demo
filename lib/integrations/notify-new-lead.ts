import { NewLeadEmail } from '@/components/email/new-lead-email'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

export type NotifyNewLeadInput = {
  leadId: string
  leadName: string
  leadEmail?: string | null
  leadPhone?: string | null
  leadCompany?: string | null
  leadSource: string
}

const log = scopedLogger('notify-new-lead')

/**
 * Notifies all active owners and admins when a new lead is created.
 *
 * - Inserts an in-app `notifications` row (event_type: "lead_new") for each recipient
 *   so the bell icon lights up in real-time via Supabase Realtime.
 * - Sends a transactional email via Resend.
 *
 * Errors inside this function are logged but never propagate — callers should
 * invoke with `.catch(() => {})` so lead creation is never blocked.
 */
export async function notifyNewLead(input: NotifyNewLeadInput): Promise<void> {
  const supabase = createAdminClient()
  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
  const leadUrl = `${appUrl}/leads/${input.leadId}`

  // ── 1. Fetch active owners and admins ────────────────────────────────────
  const { data: recipients, error: fetchError } = await supabase
    .from('team_members')
    .select('id, name, email')
    .in('role', ['owner', 'admin'])
    .is('deleted_at', null)

  if (fetchError) {
    log.error({ err: fetchError }, 'failed to fetch admin/owner recipients')
    return
  }
  if (!recipients?.length) {
    log.warn('no admin/owner recipients to notify for lead_new')
    return
  }

  // Short summary line used as the in-app notification body
  const notifBody = [input.leadName, input.leadCompany, input.leadEmail, input.leadPhone]
    .filter(Boolean)
    .join(' · ')
  const phoneDigits = input.leadPhone?.replace(/\D/g, '') ?? ''
  const callUrl = phoneDigits ? `tel:${phoneDigits}` : null
  const whatsappUrl = phoneDigits ? `https://wa.me/${phoneDigits}` : null
  const notificationActions = [{ action: 'feedback', title: 'Registrar' }]
  if (input.leadPhone) {
    notificationActions.unshift(
      { action: 'call', title: 'Llamar' },
      { action: 'whatsapp', title: 'WhatsApp' },
    )
  }

  // ── 2. In-app notification + background Push ─────────────────────────────
  await dispatchNotifications({
    recipientIds: recipients.map((r) => r.id as string),
    eventType: 'lead_new',
    entityType: 'lead',
    entityId: input.leadId,
    body: notifBody || 'Ha entrado un nuevo lead',
    link: `/leads/${input.leadId}`,
    actions: notificationActions,
    data: {
      callUrl,
      whatsappUrl,
      feedbackUrl: `/leads/${input.leadId}?feedback=call`,
    },
  })

  // ── 3. Email (render once, send to all) ──────────────────────────────────
  let html: string
  try {
    html = await renderEmail(
      NewLeadEmail({
        leadName: input.leadName,
        leadEmail: input.leadEmail ?? null,
        leadPhone: input.leadPhone ?? null,
        leadCompany: input.leadCompany ?? null,
        leadSource: input.leadSource,
        leadUrl,
        appUrl,
      }),
    )
  } catch (e) {
    log.error({ err: e }, 'failed to render NewLeadEmail')
    return
  }

  const subject = `Nuevo lead: ${input.leadName}${input.leadCompany ? ` · ${input.leadCompany}` : ''}`

  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendEmail({
        fromName: 'doscientos',
        fromAlias: 'notificaciones',
        to: r.email as string,
        subject,
        html,
        tags: { lead_id: input.leadId },
      }),
    ),
  )

  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) {
    log.error({ leadId: input.leadId, failed }, 'some lead_new emails failed to send')
  }

  log.info(
    { leadId: input.leadId, recipientCount: recipients.length, emailsFailed: failed },
    'lead_new notifications dispatched',
  )
}
