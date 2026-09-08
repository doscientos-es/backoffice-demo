import { describe, expect, it } from 'vitest'

import { renderDiagnosticPdf } from './report'

describe('renderDiagnosticPdf', () => {
  it('renders the personalised lead resource as a non-empty PDF', async () => {
    const pdf = await renderDiagnosticPdf({
      name: 'Marta Soler',
      company: 'Fincas Soler',
      answers: {
        proceso: 'Asignar solicitudes de visita',
        personas: 4,
        impacto: 'Retrasos y seguimiento manual',
      },
      metrics: {
        monthlyHours: 156,
        yearlyHours: 1872,
        yearlyCost: 46800,
        risk: 'Alta',
        primaryOpportunity: 'Centralizar solicitudes y automatizar su seguimiento.',
      },
    })

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(100_000)
  }, 30_000)
})
