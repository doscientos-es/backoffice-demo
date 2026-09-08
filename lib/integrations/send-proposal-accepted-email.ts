import { ProposalAcceptedEmail } from '@/components/email'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { scopedLogger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('proposal-accepted-email')

export async function sendProposalAcceptedEmail(proposalId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('proposals')
    .select('id, title, acceptance_email_sent_at, clients(name, email), leads(name, email)')
    .eq('id', proposalId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data || data.acceptance_email_sent_at) return

  const relations = data as unknown as {
    clients: { name: string; email: string | null } | null
    leads: { name: string; email: string | null } | null
  }
  const recipient = relations.clients?.email ?? relations.leads?.email ?? null
  const clientName = relations.clients?.name ?? relations.leads?.name ?? 'Hola'
  if (!recipient) return

  const claimedAt = new Date().toISOString()
  const { data: claimed } = await admin
    .from('proposals')
    .update({ acceptance_email_sent_at: claimedAt, acceptance_email_recipient: recipient })
    .eq('id', proposalId)
    .is('acceptance_email_sent_at', null)
    .select('id')
    .maybeSingle()
  if (!claimed) return

  try {
    const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
    const html = await renderEmail(
      ProposalAcceptedEmail({ clientName, proposalTitle: data.title as string, appUrl }),
    )
    const sent = await sendEmail({
      fromName: 'doscientos',
      fromAlias: 'hola',
      to: recipient,
      replyTo: 'hola@doscientos.es',
      subject: `Propuesta aprobada · ${data.title as string}`,
      html,
      tags: { proposal_id: proposalId, kind: 'proposal_accepted' },
    })
    await admin
      .from('proposals')
      .update({ acceptance_email_resend_id: sent.id })
      .eq('id', proposalId)
  } catch (err) {
    await admin
      .from('proposals')
      .update({
        acceptance_email_sent_at: null,
        acceptance_email_recipient: null,
        acceptance_email_resend_id: null,
      })
      .eq('id', proposalId)
      .eq('acceptance_email_sent_at', claimedAt)
    log.warn({ err, proposalId }, 'proposal acceptance email failed')
  }
}
