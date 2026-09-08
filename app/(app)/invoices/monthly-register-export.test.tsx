import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}))

import { InvoiceRegisterExport } from './monthly-register-export'

describe('InvoiceRegisterExport', () => {
  it('groups monthly and annual register downloads', () => {
    render(<InvoiceRegisterExport year={2026} />)

    fireEvent.click(screen.getByRole('button', { name: /libro registro/i }))

    const monthInput = screen.getByLabelText('Por mes') as HTMLInputElement
    expect(monthInput.value).toMatch(/^[0-9]{4}-[0-9]{2}$/)

    const links = screen.getAllByRole('link', { name: 'Descargar' })
    expect(
      links.some((link) => link.getAttribute('href')?.includes(`month=${monthInput.value}`)),
    ).toBe(true)
    expect(links.some((link) => link.getAttribute('href')?.includes('year=2026'))).toBe(true)

    const quarterlyLink = screen.getByRole('link', { name: 'Descargar CSV' })
    expect(quarterlyLink.getAttribute('href')).toMatch(
      /^\/api\/invoices\/trimestral\?year=\d{4}&quarter=[1-4]$/,
    )
  })
})
