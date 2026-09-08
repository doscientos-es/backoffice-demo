import { Resend } from 'resend'

import { serverEnv } from '@/lib/env'

let cached: Resend | null = null

export function getResend(): Resend | null {
  const env = serverEnv()
  if (!env.RESEND_API_KEY) return null
  if (cached) return cached
  cached = new Resend(env.RESEND_API_KEY)
  return cached
}

export type SendEmailInput = {
  fromName: string
  fromAlias: string
  to: string
  cc?: string[]
  replyTo?: string
  subject: string
  html: string
  tags?: Record<string, string>
  attachments?: Array<{ filename: string; content: Buffer | string }>
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<{ id: string | null; mocked: boolean }> {
  const env = serverEnv()
  const resend = getResend()
  const safeName = input.fromName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const address = input.fromAlias.includes('@')
    ? input.fromAlias
    : `${input.fromAlias}@${env.RESEND_FROM_DOMAIN}`
  const from = `"${safeName}" <${address}>`
  if (!resend) {
    return { id: null, mocked: true }
  }
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    html: input.html,
    replyTo: input.replyTo,
    attachments: input.attachments,
    tags: input.tags
      ? Object.entries(input.tags).map(([name, value]) => ({ name, value }))
      : undefined,
  })
  if (error) throw new Error(error.message)
  return { id: data?.id ?? null, mocked: false }
}
