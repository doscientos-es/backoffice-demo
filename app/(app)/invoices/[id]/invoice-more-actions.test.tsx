import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const {
  createRectification,
  deleteInvoice,
  markAsUncollectible,
  restoreInvoice,
  updateInvoiceStatus,
} = vi.hoisted(() => ({
  createRectification: vi.fn(),
  deleteInvoice: vi.fn(),
  markAsUncollectible: vi.fn(),
  restoreInvoice: vi.fn(),
  updateInvoiceStatus: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../actions', () => ({
  createRectification,
  deleteInvoice,
  markAsUncollectible,
  restoreInvoice,
  updateInvoiceStatus,
}))
vi.mock('@/lib/hooks/use-undoable-delete', () => ({
  useUndoableDelete: () => ({ run: vi.fn(), pending: false }),
}))

import { InvoiceMoreActions } from './invoice-more-actions'

describe('InvoiceMoreActions', () => {
  it('opens the available actions from the more-actions icon button', async () => {
    render(
      <InvoiceMoreActions
        invoiceId="invoice-1"
        canCancel={false}
        canDelete={false}
        canRectify
        canMarkUncollectible={false}
        feedback={{ setPending: vi.fn(), setSuccess: vi.fn(), setError: vi.fn() }}
        verifyStatusChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }))

    expect(
      await screen.findByRole('menuitem', { name: /emitir factura rectificativa/i }),
    ).toBeTruthy()
  })
})
