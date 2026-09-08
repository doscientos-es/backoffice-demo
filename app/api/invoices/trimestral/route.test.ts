import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    role: 'admin' as 'owner' | 'admin' | 'member' | 'viewer',
    fromCalls: [] as string[],
    invoiceResult: {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
    },
    expenseResult: {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
    },
    attachmentResult: {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error('not authenticated')
    return { id: 'user-1', role: state.role }
  }),
}))

vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => {
      state.fromCalls.push(table)
      let orderCount = 0
      const chain = {
        select: () => chain,
        is: () => chain,
        in: () => chain,
        gte: () => chain,
        lt: () => chain,
        order: () => {
          orderCount += 1
          const terminalOrder = table === 'attachments' ? 1 : 2
          if (orderCount < terminalOrder) return chain
          if (table === 'invoices') return Promise.resolve(state.invoiceResult)
          if (table === 'expenses') return Promise.resolve(state.expenseResult)
          return Promise.resolve(state.attachmentResult)
        },
      }
      return chain
    },
  })),
}))

import { NextRequest } from 'next/server'

import { GET } from './route'

const request = (query = '') => new NextRequest(`http://localhost/api/invoices/trimestral${query}`)

describe('GET /api/invoices/trimestral', () => {
  beforeEach(() => {
    state.authThrows = false
    state.role = 'admin'
    state.fromCalls = []
    state.invoiceResult = { data: [], error: null }
    state.expenseResult = { data: [], error: null }
    state.attachmentResult = { data: [], error: null }
  })

  it('rejects unauthenticated and non-finance users', async () => {
    state.authThrows = true
    expect((await GET(request('?year=2026&quarter=3'))).status).toBe(401)

    state.authThrows = false
    state.role = 'member'
    expect((await GET(request('?year=2026&quarter=3'))).status).toBe(403)
  })

  it('validates the quarter before querying financial data', async () => {
    expect((await GET(request('?year=2026&quarter=5'))).status).toBe(400)
    expect(state.fromCalls).toEqual([])
  })

  it('returns a lightweight accountant CSV even when the quarter is empty', async () => {
    const response = await GET(request('?year=2026&quarter=3'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="doscientos-T3-2026.csv"',
    )
    expect(state.fromCalls).toEqual(['invoices', 'expenses'])

    expect(await response.text()).toContain('"Tipo"')
  })

  it('includes invoice, expense and attachment references without creating a ZIP', async () => {
    state.invoiceResult = {
      data: [
        {
          id: 'invoice-1',
          full_number: 'A-2026-001',
          issue_date: '2026-07-01',
          client_name: 'Cliente ejemplo',
          client_nif: 'B12345678',
          subtotal: 100,
          tax_amount: 21,
          total: 121,
          status: 'issued',
          verifactu_status: 'accepted',
          verifactu_csv: 'CSV-1',
        },
      ],
      error: null,
    }
    state.expenseResult = {
      data: [
        {
          id: 'expense-1',
          vendor: 'Proveedor ejemplo',
          category: 'software',
          expense_date: '2026-07-02',
          invoice_reference: 'P-42',
          vendor_nif: 'B87654321',
          subtotal: 50,
          tax_amount: 10.5,
          total: 60.5,
          currency: 'EUR',
        },
      ],
      error: null,
    }
    state.attachmentResult = {
      data: [
        {
          expense_id: 'expense-1',
          name: 'recibo.pdf',
          web_view_link: 'https://drive.example.test/recibo',
        },
      ],
      error: null,
    }

    const response = await GET(request('?year=2026&quarter=3'))
    const csv = await response.text()

    expect(csv).toContain('"Cobro"')
    expect(csv).toContain('"Gasto"')
    expect(csv).toContain('"A-2026-001"')
    expect(csv).toContain('"recibo.pdf"')
    expect(csv).toContain('"https://drive.example.test/recibo"')
  })
})
