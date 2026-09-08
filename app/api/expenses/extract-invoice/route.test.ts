import { beforeEach, describe, expect, it, vi } from 'vitest'

const ID = '00000000-0000-4000-8000-000000000001'
const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    role: 'admin' as 'owner' | 'admin' | 'member' | 'viewer',
    attachment: {
      id: '00000000-0000-4000-8000-000000000001',
      expense_id: 'expense-1',
      mime_type: 'application/pdf',
      storage_path: 'expense/a.pdf',
    } as Record<string, unknown> | null,
    downloadError: null as string | null,
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error('not authenticated')
    return { id: 'user-1', role: state.role }
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => {
    const query = {
      select: () => query,
      eq: () => query,
      not: () => query,
      is: () => query,
      maybeSingle: async () => ({ data: state.attachment, error: null }),
    }
    return { from: () => query }
  }),
}))
vi.mock('@/lib/storage', () => ({
  getStorage: () => ({
    download: async () => ({
      data: state.downloadError ? null : new ArrayBuffer(8),
      error: state.downloadError,
    }),
  }),
}))
vi.mock('@/lib/finance/invoice-extraction', () => ({
  extractExpenseInvoice: vi.fn(async () => ({
    suggestion: {
      vendor: 'Agencia',
      description: null,
      expense_date: '2026-08-27',
      due_date: null,
      subtotal: 100,
      tax_rate: 21,
      vendor_nif: 'B12345678',
      invoice_reference: 'F-1',
      confidence: 0.9,
    },
    source: 'ai',
    warning: null,
  })),
}))

import { NextRequest } from 'next/server'

import { POST } from './route'

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/expenses/extract-invoice', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/expenses/extract-invoice', () => {
  beforeEach(() => {
    state.authThrows = false
    state.role = 'admin'
    state.attachment = {
      id: ID,
      expense_id: 'expense-1',
      mime_type: 'application/pdf',
      storage_path: 'expense/a.pdf',
    }
    state.downloadError = null
  })

  it('requires an authenticated administrator', async () => {
    state.role = 'member'
    expect((await POST(request({ attachment_id: ID }))).status).toBe(403)
  })

  it('rejects an attachment that is not a stored PDF', async () => {
    state.attachment = {
      id: ID,
      expense_id: 'expense-1',
      mime_type: 'image/jpeg',
      storage_path: 'expense/a.jpg',
    }
    expect((await POST(request({ attachment_id: ID }))).status).toBe(400)
  })

  it('returns a reviewable suggestion without saving the expense', async () => {
    const response = await POST(request({ attachment_id: ID }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      source: 'ai',
      suggestion: { vendor: 'Agencia', subtotal: 100 },
    })
  })
})
