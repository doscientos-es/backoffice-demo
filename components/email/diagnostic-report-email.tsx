import { Button, Hr, Section, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const LIGHT = '#edf3ec'
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export function DiagnosticReportEmail({
  name,
  company,
  reportUrl,
  yearlyHours,
  yearlyCost,
}: {
  name: string
  company?: string | null
  reportUrl: string
  yearlyHours: number
  yearlyCost: number
}) {
  const firstName = name.split(' ')[0] || name
  const euro = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
  return (
    <EmailLayout
      preview={`${firstName}, tu diagnóstico personalizado ya está listo`}
      appUrl={reportUrl}
    >
      <Section
        style={{
          backgroundColor: BRAND,
          borderRadius: 10,
          padding: '28px 32px',
          textAlign: 'center',
        }}
      >
        <Text style={{ fontFamily: FONT, fontSize: 28, color: '#fff', fontWeight: 700, margin: 0 }}>
          Tu diagnóstico está listo
        </Text>
      </Section>
      <Text style={heading}>Hola, {firstName}.</Text>
      <Text style={body}>
        Hemos preparado un diagnóstico personalizado{company ? ` para ${company}` : ''} con los
        datos que nos has dado en la calculadora.
      </Text>
      <Section
        style={{ backgroundColor: LIGHT, borderRadius: 8, padding: '18px 20px', margin: '20px 0' }}
      >
        <Text style={label}>Un primer dato</Text>
        <Text style={metric}>
          {yearlyHours} h/año · {euro.format(yearlyCost)} de coste estimado
        </Text>
        <Text style={small}>
          Es una estimación orientativa para ayudarte a decidir dónde merece la pena mirar primero.
        </Text>
      </Section>
      <Button
        href={reportUrl}
        style={{
          backgroundColor: BRAND,
          color: '#fff',
          borderRadius: 8,
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 700,
          padding: '12px 18px',
          textDecoration: 'none',
        }}
      >
        Ver mi diagnóstico online
      </Button>
      <Hr style={{ borderColor: '#e4e4e7', margin: '28px 0 18px' }} />
      <Text style={body}>
        Dentro encontrarás una lectura de tu situación, oportunidades de mejora, ejemplos de
        software a medida y los siguientes pasos que recomendamos.
      </Text>
      <Text style={{ ...body, fontWeight: 600, color: BRAND, margin: 0 }}>
        — El equipo de doscientos
      </Text>
    </EmailLayout>
  )
}

const heading: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 700,
  color: '#111',
  margin: '24px 0 10px',
}
const body: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  color: '#3f3f46',
  lineHeight: '22px',
  margin: '0 0 12px',
}
const label: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: BRAND,
  margin: 0,
}
const metric: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 700,
  color: '#111',
  margin: '8px 0',
}
const small: React.CSSProperties = { ...body, fontSize: 12, color: '#71717a', margin: 0 }
