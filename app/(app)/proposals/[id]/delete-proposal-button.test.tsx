import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const refresh = vi.fn()
const duplicate = vi.fn()
const reject = vi.fn()
const onDelete = vi.fn()
const successToast = vi.fn()
const errorToast = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('../actions', () => ({
  deleteProposal: vi.fn(),
  duplicateProposal: (...args: unknown[]) => duplicate(...args),
  markProposalAsRejected: (...args: unknown[]) => reject(...args),
  restoreProposal: vi.fn(),
}))
vi.mock('sileo', () => ({
  sileo: {
    success: (...args: unknown[]) => successToast(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}))
vi.mock('@/lib/hooks/use-undoable-delete', () => ({
  useUndoableDelete: () => ({ run: onDelete, pending: false }),
}))

import { ProposalMoreActions } from './delete-proposal-button'

describe('ProposalMoreActions', () => {
  beforeEach(() => {
    push.mockReset()
    refresh.mockReset()
    duplicate.mockReset()
    reject.mockReset()
    onDelete.mockReset()
    successToast.mockReset()
    errorToast.mockReset()
    duplicate.mockResolvedValue({ ok: true, id: 'duplicated-proposal' })
    reject.mockResolvedValue({ ok: true })
  })

  it('keeps secondary actions inside the overflow menu', async () => {
    render(<ProposalMoreActions proposalId="proposal-1" canReject />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Más acciones de la propuesta' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicar' }))

    await waitFor(() => expect(duplicate).toHaveBeenCalledWith({ id: 'proposal-1' }))
    expect(push).toHaveBeenCalledWith('/proposals/duplicated-proposal')

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Más acciones de la propuesta' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('confirms and records an external client rejection', async () => {
    render(<ProposalMoreActions proposalId="proposal-1" canReject />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Más acciones de la propuesta' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rechazar propuesta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar propuesta' }))

    await waitFor(() => expect(reject).toHaveBeenCalledWith({ id: 'proposal-1' }))
    expect(successToast).toHaveBeenCalledWith({ title: 'Propuesta rechazada' })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('hides rejection when the proposal cannot transition to rejected', () => {
    render(<ProposalMoreActions proposalId="proposal-1" canReject={false} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Más acciones de la propuesta' }), {
      button: 0,
      ctrlKey: false,
    })

    expect(screen.queryByRole('menuitem', { name: 'Rechazar propuesta' })).toBeNull()
  })
})
