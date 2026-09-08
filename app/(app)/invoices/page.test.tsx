import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const { capturedListPageProps, getVerifactuOperationalHealth, listInvoices, requireUser } = vi.hoisted(
  () => ({
    capturedListPageProps: { current: null as unknown },
    getVerifactuOperationalHealth: vi.fn(),
    listInvoices: vi.fn(),
    requireUser: vi.fn(),
  }),
)

vi.mock('@/components/layout/list-page', () => ({
  ListPage: (props: unknown) => {
    capturedListPageProps.current = props
    return null
  },
}))
vi.mock('@/lib/auth', () => ({ requireUser }))
vi.mock('@/lib/invoices/queries', () => ({ listInvoices }))
vi.mock('@/lib/verifactu/health', () => ({ getVerifactuOperationalHealth }))

import InvoicesPage from './page'

function findEventHandlers(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(findEventHandlers)
  if (!isValidElement(node)) return []

  return Object.entries(node.props as Record<string, unknown>).flatMap(([name, value]) => {
    const ownHandler = /^on[A-Z]/.test(name) && typeof value === 'function' ? [name] : []
    return [...ownHandler, ...(name === 'children' ? findEventHandlers(value as ReactNode) : [])]
  })
}

describe('InvoicesPage', () => {
  it('only passes serializable invoice cells to the client list', async () => {
    requireUser.mockResolvedValue({ id: 'user-1' })
    listInvoices.mockResolvedValue({
      data: [
        {
          id: 'invoice-1',
          client_id: 'client-1',
          full_number: 'A-000001',
          idfact: null,
          concepts: ['Mantenimiento'],
          status: 'issued',
          verifactu_status: 'pending',
          total: 121,
          issue_date: '2026-09-01',
          due_date: null,
          client_name: 'Cliente de prueba',
        },
      ],
      count: 1,
      stats: {
        pendingTotal: 121,
        pendingCount: 1,
        overdueTotal: 0,
        overdueCount: 0,
        paidMonthTotal: 0,
        verifactuKoCount: 0,
      },
      error: null,
    })
    getVerifactuOperationalHealth.mockResolvedValue({
      queueAvailable: true,
      pending: 0,
      retrying: 0,
      blocked: 0,
      diagnostic: { status: 'passed', ranAt: null },
      certificate: { status: 'ok', expiresAt: null, daysRemaining: null },
    })

    renderToStaticMarkup(await InvoicesPage({ searchParams: Promise.resolve({}) }))

    const props = capturedListPageProps.current as { rows: Array<{ cells: ReactNode[] }> }
    expect(props.rows).toHaveLength(1)
    expect(findEventHandlers(props.rows[0]?.cells ?? [])).toEqual([])
  })
})
