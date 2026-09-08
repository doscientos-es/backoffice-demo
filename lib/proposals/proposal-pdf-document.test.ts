import { describe, expect, it } from 'vitest'

import { DEFAULT_MAINTENANCE_OFFER } from './maintenance'
import { printableMarkdown, proposalPdfFilename, renderProposalPdf } from './proposal-pdf-document'

describe('proposal PDF helpers', () => {
  it('creates a safe download filename from the proposal number', () => {
    expect(proposalPdfFilename('P/2026 001', 'fallback-id')).toBe('propuesta-P-2026-001.pdf')
    expect(proposalPdfFilename(null, 'fallback-id')).toBe('propuesta-fallback-id.pdf')
  })

  it('turns the markdown content into PDF-friendly text', () => {
    expect(printableMarkdown('## **Alcance**\n\n[Ver detalle](https://example.test)')).toBe(
      'Alcance Ver detalle',
    )
  })

  it('renders a valid PDF document', async () => {
    const pdf = await renderProposalPdf({
      number: 'P-001',
      title: 'Automatización comercial',
      recipientName: 'Acme SL',
      validUntil: null,
      context: null,
      problems: [],
      solutions: [],
      scopeModules: [
        {
          id: 'scope-1',
          title: 'Portal de clientes',
          description: 'Un espacio privado para clientes.',
          included: ['Acceso con usuarios'],
          excluded: ['Migración histórica'],
          notes: null,
        },
      ],
      deliverables: '- Portal publicado',
      acceptanceCriteria: '- El cliente valida el acceso',
      paymentSchedule: 'half_half',
      paymentTerms: '50 % al aceptar y 50 % a la entrega.',
      changeManagementTerms: 'Los cambios fuera de alcance se presupuestan aparte.',
      terms: null,
      notes: null,
      subtotal: 1000,
      taxAmount: 210,
      total: 1210,
      items: [
        {
          id: 'item-1',
          description: 'Implementación',
          quantity: 1,
          unitPrice: 1000,
          vatRate: 21,
          subtotal: 1000,
          billingCycle: 'none',
        },
      ],
      maintenanceOffer: DEFAULT_MAINTENANCE_OFFER,
      maintenanceSelectedPlanId: 'growth',
      portalUrl: 'https://example.test/p/proposal/token',
      companyName: 'Doscientos S.L.',
      iban: 'ES12 3456 7890 1234 5678 9012',
    })

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
