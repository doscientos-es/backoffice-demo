import { describe, expect, it } from 'vitest'

import { renderEmail } from '@/lib/email/render'

import { LeadConfirmationEmail } from './lead-confirmation-email'

const resource = {
  slug: 'calculadora-coste-oculto',
  title: 'Calculadora del coste del trabajo manual',
  description: 'Calcula el coste anual de un proceso repetitivo.',
  href: 'https://doscientos.es/automatizar-excel?ref=email-confirmacion#calculadora-coste',
  cta: 'Abrir calculadora',
}

describe('LeadConfirmationEmail', () => {
  it('explains the service and links cases and the cost calculator', async () => {
    const html = await renderEmail(
      LeadConfirmationEmail({
        leadName: 'María López',
        appUrl: 'https://app.doscientos.es',
        resource,
        calculatorCost: '12500',
        calculatorHours: '420',
      }),
    )

    expect(html).toContain('Hola,')
    expect(html).toContain('María')
    expect(html).toContain('próximas horas laborables')
    expect(html).toContain('software a medida')
    expect(html).toContain('Ver casos de éxito')
    expect(html).toContain('https://doscientos.es/projects?ref=email-confirmacion')
    expect(html).toContain('Probar la calculadora de costes')
    expect(html).toContain('Resultado de tu calculadora')
    expect(html).toContain('Horas estimadas al año:')
    expect(html).toContain('420')
    expect(html).toContain('Coste anual estimado:')
    expect(html).toContain('12500')
  })
})
