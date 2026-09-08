'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { externalAppUrl } from '@/lib/email/app-url'
import { sendEmail } from '@/lib/email/resend'
import { markdownToHtml } from '@/lib/email/templates'
import { addEmailTracking } from '@/lib/email/tracking'
import { publicEnv } from '@/lib/env'
import {
  getNewsletterIssue,
  listNewsletterRecipients,
  type NewsletterRecipient,
} from '@/lib/marketing/newsletters'
import { optionalDate, optionalText, requiredText } from '@/lib/schemas/common'
import { createServerClient } from '@/lib/supabase/server'

const AudienceInput = z.enum([
  'all_leads',
  'active_leads',
  'calculator_leads',
  'lost_leads',
  'clients',
])

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90)
}

const NewsletterIssueInput = z.object({
  title: requiredText(140, 'Titulo obligatorio'),
  slug: optionalText(120),
  subject: requiredText(160, 'Asunto obligatorio'),
  previewText: optionalText(220),
  bodyMarkdown: requiredText(12000, 'Contenido obligatorio'),
  ctaLabel: optionalText(80),
  ctaUrl: optionalText(500),
  audienceKey: AudienceInput.default('active_leads'),
  scheduledAt: optionalDate,
  publishNow: z
    .string()
    .optional()
    .transform((value) => value === 'on'),
})

function renderNewsletterHtml(issue: {
  body_markdown: string
  cta_label: string | null
  cta_url: string | null
}): string {
  const publicBase = 'https://doscientos.es'
  const ctaUrl = issue.cta_url?.startsWith('/') ? `${publicBase}${issue.cta_url}` : issue.cta_url
  const cta =
    issue.cta_label && ctaUrl
      ? `\n\n<p><a href="${ctaUrl}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#111;color:#fff;text-decoration:none">${issue.cta_label}</a></p>`
      : ''
  return markdownToHtml(`${issue.body_markdown}${cta}`)
}

function appendNewsletterFooter(html: string, appUrl: string, token: string): string {
  const unsubscribeUrl = `${appUrl.replace(/\/+$/, '')}/api/track/unsubscribe/${token}`
  return `${html}
<hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0 16px" />
<p style="font-size:12px;line-height:18px;color:#6b7280">
Recibes este email porque has contactado con doscientos o has solicitado un recurso.
<a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">Darte de baja</a>.
</p>`
}

function renderForRecipient(html: string, recipient: NewsletterRecipient): string {
  return html
    .replace(/\{\{\s*nombre\s*\}\}/g, recipient.name ?? '')
    .replace(/\{\{\s*empresa\s*\}\}/g, recipient.company ?? '')
    .replace(/\{\{\s*email\s*\}\}/g, recipient.email)
}

export const createNewsletterIssue = defineAction({
  name: 'newsletters.create',
  schema: NewsletterIssueInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: () => ['/marketing/newsletters'],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()
    const slug = input.slug ? slugify(input.slug) : slugify(input.title)
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null
    const publishedAt = input.publishNow ? new Date().toISOString() : null
    const status = publishedAt ? 'published' : scheduledAt ? 'scheduled' : 'draft'
    const bodyHtml = markdownToHtml(input.bodyMarkdown)

    const { data: campaign, error: campaignError } = await supabase
      .from('lead_campaigns')
      .insert({
        name: `Newsletter - ${input.title}`,
        subject: input.subject,
        body_html: bodyHtml,
        status: 'draft',
        created_by: user.id,
      })
      .select('id')
      .single()
    if (campaignError || !campaign) {
      throw new Error(campaignError?.message ?? 'No se pudo preparar la campana')
    }

    const { data, error } = await supabase
      .from('newsletter_issues')
      .insert({
        title: input.title,
        slug,
        subject: input.subject,
        preview_text: input.previewText ?? null,
        body_markdown: input.bodyMarkdown,
        cta_label: input.ctaLabel ?? null,
        cta_url: input.ctaUrl ?? null,
        audience_key: input.audienceKey,
        scheduled_at: scheduledAt,
        published_at: publishedAt,
        public_slug: publishedAt ? slug : null,
        status,
        lead_campaign_id: campaign.id as string,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear la newsletter')
    return { id: data.id as string }
  },
})

export const publishNewsletterIssue = defineAction({
  name: 'newsletters.publish',
  schema: z.object({ id: z.string().uuid() }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => ['/marketing/newsletters'],
  handler: async ({ id }) => {
    const supabase = await createServerClient()
    const { data: issue, error: readError } = await supabase
      .from('newsletter_issues')
      .select('slug')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    if (readError || !issue) throw new Error(readError?.message ?? 'Newsletter no encontrada')

    const { error } = await supabase
      .from('newsletter_issues')
      .update({
        status: 'published',
        public_slug: issue.slug as string,
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
})

export const sendNewsletterTest = defineAction({
  name: 'newsletters.sendTest',
  schema: z.object({
    id: z.string().uuid(),
    testEmail: z.string().email('Email de prueba no valido'),
  }),
  roles: ['owner', 'admin', 'member'],
  revalidate: () => ['/marketing/newsletters'],
  handler: async ({ id, testEmail }, { user }) => {
    if (!user.emailAlias) throw new Error('No tienes un alias configurado en tu perfil.')

    const issue = await getNewsletterIssue(id)
    if (!issue) throw new Error('Newsletter no encontrada')

    const baseHtml = renderNewsletterHtml(issue)
    const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
    const testToken = crypto.randomUUID()
    const html = appendNewsletterFooter(
      addEmailTracking(baseHtml, appUrl, testToken),
      appUrl,
      testToken,
    )

    await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias,
      to: testEmail,
      replyTo: user.email,
      subject: `[Prueba] ${issue.subject}`,
      html,
      tags: { newsletter_issue_id: issue.id, test: 'true' },
    })
  },
})

export const sendNewsletterIssue = defineAction({
  name: 'newsletters.send',
  schema: z.object({
    id: z.string().uuid(),
    confirmSend: z
      .string()
      .optional()
      .transform((value) => value === 'on')
      .refine(Boolean, 'Confirma el envio antes de continuar'),
  }),
  roles: ['owner', 'admin'],
  revalidate: () => ['/marketing/newsletters'],
  handler: async ({ id }, { user }) => {
    if (!user.emailAlias) throw new Error('No tienes un alias configurado en tu perfil.')

    const supabase = await createServerClient()
    const issue = await getNewsletterIssue(id)
    if (!issue) throw new Error('Newsletter no encontrada')
    if (issue.sent_at) throw new Error('Esta newsletter ya se ha enviado.')

    const recipients = await listNewsletterRecipients(issue.audience_key)
    if (recipients.length === 0)
      throw new Error('No hay destinatarios validos para esta audiencia.')
    if (recipients.length > 500)
      throw new Error('La audiencia supera el limite operativo de 500 emails.')

    let campaignId = issue.lead_campaign_id
    const baseHtml = renderNewsletterHtml(issue)
    if (!campaignId) {
      const { data: campaign, error } = await supabase
        .from('lead_campaigns')
        .insert({
          name: `Newsletter - ${issue.title}`,
          subject: issue.subject,
          body_html: baseHtml,
          status: 'draft',
          created_by: user.id,
        })
        .select('id')
        .single()
      if (error || !campaign) throw new Error(error?.message ?? 'No se pudo preparar la campana')
      campaignId = campaign.id as string
      await supabase.from('newsletter_issues').update({ lead_campaign_id: campaignId }).eq('id', id)
    }

    await supabase.from('lead_campaigns').update({ status: 'sending' }).eq('id', campaignId)

    const { data: previousSends } = await supabase
      .from('lead_campaign_sends')
      .select('email')
      .eq('campaign_id', campaignId)
      .not('sent_at', 'is', null)
    const alreadySent = new Set(
      ((previousSends ?? []) as { email: string }[]).map((row) => row.email.toLowerCase()),
    )
    const pendingRecipients = recipients.filter(
      (recipient) => !alreadySent.has(recipient.email.toLowerCase()),
    )
    if (pendingRecipients.length === 0) throw new Error('No quedan destinatarios pendientes.')

    const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
    let sentCount = 0
    try {
      for (const recipient of pendingRecipients) {
        const { data: sendRow, error: sendError } = await supabase
          .from('lead_campaign_sends')
          .insert({
            campaign_id: campaignId,
            lead_id: recipient.lead_id,
            email: recipient.email,
          })
          .select('id, tracking_token')
          .single()
        if (sendError || !sendRow)
          throw new Error(sendError?.message ?? 'No se pudo preparar envio')

        const token = sendRow.tracking_token as string
        const html = appendNewsletterFooter(
          addEmailTracking(renderForRecipient(baseHtml, recipient), appUrl, token),
          appUrl,
          token,
        )
        const sent = await sendEmail({
          fromName: user.name,
          fromAlias: user.emailAlias,
          to: recipient.email,
          replyTo: user.email,
          subject: issue.subject,
          html,
          tags: {
            newsletter_issue_id: issue.id,
            campaign_send_id: sendRow.id as string,
          },
        })

        await supabase
          .from('lead_campaign_sends')
          .update({
            resend_email_id: sent.id,
            sent_at: new Date().toISOString(),
          })
          .eq('id', sendRow.id)

        if (recipient.lead_id) {
          await supabase.from('lead_interactions').insert({
            lead_id: recipient.lead_id,
            type: 'email_sent',
            subject: issue.subject,
            body: html,
            resend_email_id: sent.id,
            performed_by: user.id,
            payload: {
              newsletter_issue_id: issue.id,
              campaign_id: campaignId,
              campaign_send_id: sendRow.id,
              mocked: sent.mocked,
            },
          })
        }

        sentCount += 1
      }
    } catch (error) {
      await supabase.from('lead_campaigns').update({ status: 'paused' }).eq('id', campaignId)
      throw error
    }

    const now = new Date().toISOString()
    await Promise.all([
      supabase
        .from('lead_campaigns')
        .update({ status: 'sent', body_html: baseHtml })
        .eq('id', campaignId),
      supabase
        .from('newsletter_issues')
        .update({ status: 'sent', sent_at: now, lead_campaign_id: campaignId })
        .eq('id', id),
    ])

    return { sentCount }
  },
})

export async function createNewsletterIssueForm(formData: FormData): Promise<void> {
  const result = await createNewsletterIssue(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath('/marketing/newsletters')
}

export async function publishNewsletterIssueForm(formData: FormData): Promise<void> {
  const result = await publishNewsletterIssue(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath('/marketing/newsletters')
}

export async function sendNewsletterTestForm(formData: FormData): Promise<void> {
  const result = await sendNewsletterTest(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath('/marketing/newsletters')
}

export async function sendNewsletterIssueForm(formData: FormData): Promise<void> {
  const result = await sendNewsletterIssue(formData)
  if (!result.ok) throw new Error(result.error)
  revalidatePath('/marketing/newsletters')
}
