import { GOOGLE_SCOPES, googleFetch } from './client'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_MESSAGES_PER_MAILBOX = 50
const MAX_BODY_LENGTH = 20_000

type GmailHeader = { name?: string; value?: string }
type GmailPart = {
  mimeType?: string
  headers?: GmailHeader[]
  body?: { data?: string }
  parts?: GmailPart[]
}
type GmailMessage = {
  id: string
  threadId?: string
  labelIds?: string[]
  internalDate?: string
  payload?: GmailPart
}
type GmailMessageList = { messages?: Array<Pick<GmailMessage, 'id' | 'threadId'>> }

export type GmailLeadMessage = {
  gmailMessageId: string
  gmailThreadId: string | null
  rfcMessageId: string | null
  mailbox: string
  direction: 'incoming' | 'outgoing'
  subject: string | null
  body: string | null
  createdAt: string
  from: string | null
  to: string | null
  cc: string | null
}

export type GmailLeadSyncSource = {
  messages: GmailLeadMessage[]
  scanned: number
  synchronizedMailboxes: number
  unavailableMailboxes: string[]
}

/** Combines active member inboxes with admin-configured shared mailboxes. */
export function resolveGmailSyncMailboxes(
  memberEmails: Array<string | null | undefined>,
  generalMailboxes: Array<string | null | undefined>,
  workspaceDomain: string,
): string[] {
  const domain = workspaceDomain.trim().toLowerCase()
  return [...memberEmails, ...generalMailboxes]
    .filter((email): email is string => typeof email === 'string')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.endsWith(`@${domain}`))
    .filter((email, index, values) => values.indexOf(email) === index)
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? null
}

function decodeBase64Url(value: string): string {
  try {
    return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  } catch {
    return ''
  }
}

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function findPartBody(part: GmailPart | undefined, mimeType: string): string | null {
  if (!part) return null
  if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) {
    return decodeBase64Url(part.body.data)
  }
  for (const child of part.parts ?? []) {
    const result = findPartBody(child, mimeType)
    if (result) return result
  }
  return null
}

function bodyFromPayload(payload: GmailPart | undefined): string | null {
  const text = findPartBody(payload, 'text/plain')
  const html = text ? null : findPartBody(payload, 'text/html')
  const body = (text ?? (html ? plainTextFromHtml(html) : '')).replace(/\s+/g, ' ').trim()
  return body ? body.slice(0, MAX_BODY_LENGTH) : null
}

function messageDate(internalDate: string | undefined): string {
  const millis = Number(internalDate)
  return Number.isFinite(millis) ? new Date(millis).toISOString() : new Date().toISOString()
}

async function listMailboxMessages(
  mailbox: string,
  leadEmail: string,
): Promise<GmailLeadMessage[]> {
  const listUrl = new URL(`${GMAIL_API_BASE}/messages`)
  listUrl.searchParams.set(
    'q',
    `in:anywhere -label:drafts {from:${leadEmail} to:${leadEmail} cc:${leadEmail} bcc:${leadEmail}}`,
  )
  listUrl.searchParams.set('maxResults', String(MAX_MESSAGES_PER_MAILBOX))

  const list = await googleFetch<GmailMessageList>(
    mailbox,
    [GOOGLE_SCOPES.gmail],
    listUrl.toString(),
  )
  const messages: GmailLeadMessage[] = []

  for (const item of list.messages ?? []) {
    const messageUrl = new URL(`${GMAIL_API_BASE}/messages/${encodeURIComponent(item.id)}`)
    messageUrl.searchParams.set('format', 'full')
    const message = await googleFetch<GmailMessage>(
      mailbox,
      [GOOGLE_SCOPES.gmail],
      messageUrl.toString(),
    )
    const headers = message.payload?.headers
    messages.push({
      gmailMessageId: message.id,
      gmailThreadId: message.threadId ?? item.threadId ?? null,
      rfcMessageId: getHeader(headers, 'Message-ID'),
      mailbox,
      direction: message.labelIds?.includes('SENT') ? 'outgoing' : 'incoming',
      subject: getHeader(headers, 'Subject'),
      body: bodyFromPayload(message.payload),
      createdAt: messageDate(message.internalDate),
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      cc: getHeader(headers, 'Cc'),
    })
  }

  return messages
}

/**
 * Reads the newest matching messages for one lead from the supplied Workspace
 * mailboxes. A failing alias/group does not block the remaining mailboxes.
 */
export async function listLeadGmailMessages(
  leadEmail: string,
  mailboxes: string[],
): Promise<GmailLeadSyncSource> {
  const settled = await Promise.allSettled(
    mailboxes.map(async (mailbox) => ({
      mailbox,
      messages: await listMailboxMessages(mailbox, leadEmail),
    })),
  )
  const messages: GmailLeadMessage[] = []
  const unavailableMailboxes: string[] = []
  let synchronizedMailboxes = 0

  for (const [index, result] of settled.entries()) {
    if (result.status === 'fulfilled') {
      synchronizedMailboxes++
      messages.push(...result.value.messages)
    } else {
      const mailbox = mailboxes[index]
      if (mailbox) unavailableMailboxes.push(mailbox)
    }
  }

  return { messages, scanned: messages.length, synchronizedMailboxes, unavailableMailboxes }
}
