import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  pathname: '/invoices',
  params: new URLSearchParams(),
  push: vi.fn(),
  prefetch: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    prefetch: navigation.prefetch,
    push: navigation.push,
    replace: navigation.replace,
  }),
  useSearchParams: () => navigation.params,
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { ListPage } from './list-page'

describe('ListPage', () => {
  beforeEach(() => {
    navigation.push.mockReset()
  })

  it('does not navigate the row when an inner link is clicked', () => {
    render(
      <ListPage
        title="Facturas"
        empty="Sin facturas"
        headers={['Factura', 'Cliente']}
        rows={[
          {
            id: 'invoice-1',
            href: '/invoices/invoice-1',
            cells: ['FAC-001', <a key="client" href="/clients/client-1">Cliente</a>],
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('link', { name: 'Cliente' }))

    expect(navigation.push).not.toHaveBeenCalled()
  })
})
