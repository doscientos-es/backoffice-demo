import { describe, expect, it } from 'vitest'

import { renderEmail } from '@/lib/email/render'

import { PaymentReceiptEmail } from './payment-receipt-email'

describe('PaymentReceiptEmail', () => {
  const sampleProps = {
    clientName: 'Pol Gubau',
    proposalNumber: 'P-2026-001',
    proposalTitle: 'Web Development',
    amount: '60,50 €',
    paymentDate: '25 de junio de 2026',
    reference: '123456789',
    receiptUrl: 'https://app.doscientos.es/p/proposal/token/receipt/id',
    appUrl: 'https://app.doscientos.es',
  }

  it('renders the correct information in the HTML', async () => {
    const html = await renderEmail(PaymentReceiptEmail(sampleProps))

    // Basic greeting and text
    expect(html).toContain('Hola')
    expect(html).toContain('Pol Gubau')
    expect(html).toContain('Web Development')
    expect(html).toContain('60,50 €')

    // Summary card details
    expect(html).toContain('P-2026-001')
    expect(html).toContain('25 de junio de 2026')
    expect(html).toContain('123456789')

    // CTA Button
    expect(html).toContain('href="https://app.doscientos.es/p/proposal/token/receipt/id"')
    expect(html).toContain('Ver justificante')

    // Branding/Preview
    expect(html).toContain('Pago confirmado')
  })
})
