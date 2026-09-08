'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ProposalMessageEmail } from '@/components/email'
import { requireUser } from '@/lib/auth'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export async function replyToProposalMessage(
  proposalId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()
  const parsedId = z.string().uuid().safeParse(proposalId)
  const parsedBody = z.string().trim().min(1).max(2000).safeParse(body)
  if (!parsedId.success || !parsedBody.success)
    return { ok: false, error: 'La respuesta no es válida' }

  const admin = createAdminClient()
  const { data: proposal, error } = await admin
    .from('proposals')
    .select('title, portal_token, clients(name, email), leads(name, email)')
    .eq('id', parsedId.data)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !proposal) return { ok: false, error: 'Propuesta no encontrada' }

  const { error: insertError } = await admin.from('proposal_messages').insert({
    proposal_id: parsedId.data,
    author_type: 'team',
    author_name: user.name,
    body: parsedBody.data,
  })
  if (insertError) return { ok: false, error: 'No se pudo enviar la respuesta' }

  const client = (
    proposal as unknown as {
      clients: { name: string; email: string | null } | null
    }
  ).clients
  const lead = (
    proposal as unknown as {
      leads: { name: string; email: string | null } | null
    }
  ).leads
  const recipient = client?.email ?? lead?.email
  const recipientName = client?.name ?? lead?.name ?? 'Hola'
  if (recipient && proposal.portal_token) {
    try {
      const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
      await sendEmail({
        fromName: user.name,
        fromAlias: user.emailAlias ?? 'propuestas',
        replyTo: user.contactEmail ?? user.email,
        to: recipient,
        subject: `Respuesta a tu consulta · ${proposal.title as string}`,
        html: await renderEmail(
          ProposalMessageEmail({
            clientName: recipientName,
            proposalTitle: proposal.title as string,
            portalUrl: `${appUrl}/p/proposal/${proposal.portal_token as string}`,
            appUrl,
          }),
        ),
        tags: { proposal_id: proposalId, kind: 'proposal_message' },
      })
    } catch {
      // The message is still safely available in the proposal portal.
    }
  }

  revalidatePath(`/proposals/${proposalId}`)
  if (proposal.portal_token) revalidatePath(`/p/proposal/${proposal.portal_token as string}`)
  return { ok: true }
}
