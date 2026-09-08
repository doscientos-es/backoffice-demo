import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InvoiceIssuanceProgressDialog } from './invoice-issuance-progress-dialog'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('InvoiceIssuanceProgressDialog', () => {
  it('shows every completed fiscal step and the AEAT CSV after acceptance', () => {
    render(
      <InvoiceIssuanceProgressDialog
        open
        phase="accepted"
        error={null}
        csv="CSV-123"
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Factura emitida y aceptada')).toBeDefined()
    expect(screen.getByText('Registro fiscal inmutable')).toBeDefined()
    expect(screen.getByText('QR fiscal sincronizado con el RegistroAlta')).toBeDefined()
    expect(screen.getByText('CSV AEAT · CSV-123')).toBeDefined()
  })

  it('explains when durable delivery remains queued', () => {
    render(
      <InvoiceIssuanceProgressDialog
        open
        phase="deferred"
        error={null}
        csv={null}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('En cola: se reintentará respetando el control de flujo')).toBeDefined()
    expect(screen.getByText('Solo se sincroniza tras la aceptación de AEAT')).toBeDefined()
  })
})
