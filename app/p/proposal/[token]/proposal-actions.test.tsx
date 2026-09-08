import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({ acceptProposal: vi.fn(), rejectProposal: vi.fn() }))

import { acceptProposal } from './actions'
import { ProposalActions } from './proposal-actions'

const accept = vi.mocked(acceptProposal)
const props = {
  token: '12345678-1234-4123-8123-123456789abc',
  needsFiscal: false,
  fiscalPrefill: {
    name: '',
    nif: '',
    billing_address: '',
    contact_person: '',
    email: '',
    phone: '',
  },
}

describe('ProposalActions', () => {
  beforeEach(() => {
    accept.mockReset()
    accept.mockResolvedValue({ ok: true })
  })

  it('accepts a proposal directly when fiscal data is already available', async () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar propuesta' }))

    await waitFor(() => expect(accept).toHaveBeenCalledWith(props.token))
    expect(await screen.findByText('Propuesta aceptada. Gracias.')).toBeDefined()
  })
})
