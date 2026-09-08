import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mocks, state } = vi.hoisted(() => ({
  mocks: {
    gte: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  },
  state: {
    authThrows: false,
    queryResult: {
      data: [] as Array<Record<string, unknown>>,
      error: null as { message: string } | null,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error('Not authenticated')
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({ select: mocks.select }),
  })),
}))

import { NextRequest } from 'next/server'

import { GET } from './route'

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/invoices/libro-registro${query}`)
}

describe('GET /api/invoices/libro-registro', () => {
  beforeEach(() => {
    state.authThrows = false
    state.queryResult = { data: [], error: null }
    mocks.is.mockReturnValue({ in: mocks.in })
    mocks.in.mockReturnValue({ gte: mocks.gte })
    mocks.gte.mockReturnValue({ lt: mocks.lt, lte: mocks.lte })
    mocks.lt.mockReturnValue({ order: mocks.order })
    mocks.lte.mockReturnValue({ order: mocks.order })
    mocks.order
      .mockImplementationOnce(() => ({ order: mocks.order }))
      .mockImplementationOnce(async () => state.queryResult)
    mocks.select.mockReturnValue({ is: mocks.is })
  })

  it('returns 401 when unauthenticated', async () => {
    state.authThrows = true
    expect((await GET(request())).status).toBe(401)
  })

  it('rejects an invalid month before querying invoices', async () => {
    const response = await GET(request('?month=2026-13'))
    expect(response.status).toBe(400)
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('exports the selected month with a BOM and an accountant-friendly filename', async () => {
    state.queryResult = {
      data: [
        {
          full_number: 'A-000001',
          issue_date: '2026-08-04',
          due_date: null,
          client_nif: 'B123',
          client_name: 'Cliente, "S.L."',
          subtotal: 100,
          tax_amount: 21,
          total: 121,
          verifactu_csv: 'CSV-1',
          verifactu_status: 'accepted',
          status: 'issued',
          payment_method: 'transfer',
          invoice_type: 'F1',
        },
      ],
      error: null,
    }

    const response = await GET(request('?month=2026-08'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="facturas-2026-08.csv"',
    )
    expect(mocks.gte).toHaveBeenCalledWith('issue_date', '2026-08-01')
    expect(mocks.lt).toHaveBeenCalledWith('issue_date', '2026-09-01')
    await expect(response.text()).resolves.toContain('"Cliente, ""S.L."""')
  })
})
