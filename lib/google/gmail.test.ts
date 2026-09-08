import { beforeEach, describe, expect, it, vi } from 'vitest'

const { googleFetch } = vi.hoisted(() => ({ googleFetch: vi.fn() }))

vi.mock('./client', () => ({
  GOOGLE_SCOPES: { gmail: 'gmail-scope' },
  googleFetch,
}))

import { listLeadGmailMessages, resolveGmailSyncMailboxes } from './gmail'

const encoded = Buffer.from('Hola desde Gmail', 'utf8').toString('base64url')

describe('listLeadGmailMessages', () => {
  beforeEach(() => {
    googleFetch.mockReset()
  })

  it('imports sent messages with the original date and RFC Message-ID', async () => {
    googleFetch.mockImplementation(async (mailbox: string, _scopes: string[], url: string) => {
      if (url.endsWith('/messages?')) return { messages: [] }
      if (url.includes('/messages?') && mailbox === 'pol@doscientos.es') {
        return { messages: [{ id: 'gmail-1', threadId: 'thread-1' }] }
      }
      if (url.includes('/messages/')) {
        return {
          id: 'gmail-1',
          threadId: 'thread-1',
          labelIds: ['SENT'],
          internalDate: '1722513600000',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'Pol <pol@doscientos.es>' },
              { name: 'To', value: 'Lead <lead@example.test>' },
              { name: 'Subject', value: 'Seguimiento' },
              { name: 'Message-ID', value: '<external-message@example.test>' },
            ],
            body: { data: encoded },
          },
        }
      }
      return { messages: [] }
    })

    const result = await listLeadGmailMessages('lead@example.test', [
      'pol@doscientos.es',
      'gerard@doscientos.es',
      'hola@doscientos.es',
    ])

    expect(result.synchronizedMailboxes).toBe(3)
    expect(result.unavailableMailboxes).toEqual([])
    expect(result.messages).toEqual([
      expect.objectContaining({
        mailbox: 'pol@doscientos.es',
        gmailMessageId: 'gmail-1',
        gmailThreadId: 'thread-1',
        rfcMessageId: '<external-message@example.test>',
        direction: 'outgoing',
        body: 'Hola desde Gmail',
        createdAt: '2024-08-01T12:00:00.000Z',
      }),
    ])
  })

  it('keeps synchronizing the available mailboxes when one cannot be impersonated', async () => {
    googleFetch.mockImplementation(async (mailbox: string, _scopes: string[], _url: string) => {
      if (mailbox === 'hola@doscientos.es') throw new Error('not a Gmail mailbox')
      return { messages: [] }
    })

    const result = await listLeadGmailMessages('lead@example.test', [
      'pol@doscientos.es',
      'gerard@doscientos.es',
      'hola@doscientos.es',
    ])

    expect(result.synchronizedMailboxes).toBe(2)
    expect(result.unavailableMailboxes).toEqual(['hola@doscientos.es'])
    expect(result.scanned).toBe(0)
  })
})

describe('resolveGmailSyncMailboxes', () => {
  it('combines active member and general Workspace inboxes without duplicates', () => {
    expect(
      resolveGmailSyncMailboxes(
        ['Pol@doscientos.es', null, 'external@example.test'],
        ['hola@doscientos.es', 'pol@doscientos.es', ''],
        'doscientos.es',
      ),
    ).toEqual(['pol@doscientos.es', 'hola@doscientos.es'])
  })
})
