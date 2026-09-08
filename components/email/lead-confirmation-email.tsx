import { Button, Hr, Section, Text } from '@react-email/components'

import type { LeadResource } from '@/lib/integrations/lead-resources'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const BRAND_LIGHT = '#edf3ec'
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const CASES_URL = 'https://doscientos.es/projects?ref=email-confirmacion'
const CALCULATOR_URL =
  'https://doscientos.es/automatizar-excel?ref=email-confirmacion#calculadora-coste'

export type LeadConfirmationEmailProps = {
  /** Lead's first name or full name, used in the greeting. */
  leadName: string
  /** Absolute base URL of the app (for logo resolution). */
  appUrl: string
  /** Contextual resource selected from the lead source/ref. */
  resource: LeadResource
  calculatorCost?: string | null
  calculatorHours?: string | null
}

/**
 * Confirmation email sent to the lead right after their request is received.
 *
 * Usage:
 *   const html = await renderEmail(LeadConfirmationEmail({ leadName, appUrl, resource }));
 *   await sendEmail({ fromName: "doscientos", fromAlias: "hola", subject: "...", html });
 */
export function LeadConfirmationEmail({
  leadName,
  appUrl,
  resource,
  calculatorCost,
  calculatorHours,
}: LeadConfirmationEmailProps) {
  const firstName = leadName.split(' ')[0] ?? leadName
  const hasCalculatorSummary = Boolean(calculatorCost || calculatorHours)

  return (
    <EmailLayout
      preview={`${firstName}, hemos recibido tu solicitud y te contactaremos muy pronto`}
      appUrl={appUrl}
    >
      {/* Hero accent band */}
      <Section
        style={{
          backgroundColor: BRAND,
          borderRadius: 10,
          padding: '28px 32px',
          marginBottom: 28,
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: FONT,
            fontSize: 36,
            margin: '0 0 8px',
            lineHeight: 1,
          }}
        >
          ✅
        </Text>
        <Text
          style={{
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 700,
            color: '#ffffff',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: '28px',
          }}
        >
          Solicitud recibida
        </Text>
      </Section>

      {/* Greeting */}
      <Text style={headingStyle}>Hola, {firstName}!</Text>
      <Text style={bodyStyle}>
        Hemos recibido tus datos a través de uno de nuestros formularios y ya están en manos de
        nuestro equipo. Nos pondremos en contacto contigo en las próximas horas laborables.
      </Text>

      <Section style={aboutStyle}>
        <Text style={{ ...labelStyle, color: BRAND, marginBottom: 8 }}>Qué hacemos</Text>
        <Text style={{ ...stepBodyStyle, marginBottom: 16 }}>
          En doscientos creamos software a medida, automatizamos procesos y desarrollamos webs para
          que las empresas ahorren tiempo, reduzcan errores y trabajen con más control.
        </Text>
        <Button href={CASES_URL} style={primaryButtonStyle}>
          Ver casos de éxito
        </Button>
        <Text style={{ ...stepBodyStyle, margin: '12px 0 8px' }}>
          También puedes estimar cuánto cuesta al año ese trabajo manual que se repite en tu equipo.
        </Text>
        <Button href={CALCULATOR_URL} style={secondaryButtonStyle}>
          Probar la calculadora de costes
        </Button>
      </Section>

      {hasCalculatorSummary ? (
        <Section
          style={{
            backgroundColor: '#f4f4f5',
            borderRadius: 8,
            padding: '16px 20px',
            margin: '20px 0 8px',
          }}
        >
          <Text style={{ ...labelStyle, color: BRAND, marginBottom: 8 }}>
            Resultado de tu calculadora
          </Text>
          {calculatorHours ? (
            <Text style={stepBodyStyle}>Horas estimadas al año: {calculatorHours} h</Text>
          ) : null}
          {calculatorCost ? (
            <Text style={{ ...stepBodyStyle, marginTop: 4 }}>
              Coste anual estimado: {calculatorCost} EUR
            </Text>
          ) : null}
        </Section>
      ) : null}

      {resource.slug !== 'calculadora-coste-oculto' ? (
        <Section
          style={{
            backgroundColor: BRAND_LIGHT,
            borderRadius: 8,
            padding: '18px 20px',
            margin: '20px 0 24px',
          }}
        >
          <Text style={{ ...labelStyle, color: BRAND, marginBottom: 8 }}>Recurso recomendado</Text>
          <Text style={stepTitleStyle}>{resource.title}</Text>
          <Text style={{ ...stepBodyStyle, marginBottom: 16 }}>{resource.description}</Text>
          <Button href={resource.href} style={primaryButtonStyle}>
            {resource.cta}
          </Button>
        </Section>
      ) : null}

      <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0' }} />

      {/* What happens next */}
      <Text
        style={{
          ...labelStyle,
          color: BRAND,
          marginBottom: 16,
        }}
      >
        ¿Qué pasa ahora?
      </Text>

      {STEPS.map((step, i) => (
        <Section
          key={step.title}
          style={{
            backgroundColor: i % 2 === 0 ? BRAND_LIGHT : '#fafafa',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 8,
          }}
        >
          <Text style={{ ...stepNumStyle, color: BRAND }}>{String(i + 1).padStart(2, '0')}</Text>
          <Text style={stepTitleStyle}>{step.title}</Text>
          <Text style={stepBodyStyle}>{step.body}</Text>
        </Section>
      ))}

      <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0 16px' }} />
      <Text style={{ ...bodyStyle, color: '#71717a' }}>
        Si tienes cualquier pregunta mientras tanto, responde directamente a este email y te
        atenderemos encantados.
      </Text>
      <Text style={{ ...bodyStyle, fontWeight: 600, color: BRAND, margin: 0 }}>
        — El equipo de doscientos
      </Text>
    </EmailLayout>
  )
}

const STEPS = [
  {
    title: 'Entendemos tu caso',
    body: 'Revisamos la información para que la primera conversación sea concreta y útil.',
  },
  {
    title: 'Te contactamos',
    body: 'Te llamamos o escribimos para agendar una primera conversación sin compromiso.',
  },
  {
    title: 'Acordamos el siguiente paso',
    body: 'Si podemos ayudarte, te explicamos una propuesta clara de alcance, plazos y prioridades.',
  },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 700,
  color: '#111111',
  margin: '0 0 10px',
  letterSpacing: '-0.02em',
}

const bodyStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  color: '#3f3f46',
  lineHeight: '22px',
  margin: '0 0 12px',
}

const aboutStyle: React.CSSProperties = {
  backgroundColor: '#fafafa',
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  padding: '18px 20px',
  margin: '20px 0 24px',
}

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: BRAND,
  color: '#ffffff',
  borderRadius: 8,
  fontFamily: FONT,
  fontSize: 13,
  fontWeight: 700,
  padding: '10px 14px',
  textDecoration: 'none',
}

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  backgroundColor: '#ffffff',
  color: BRAND,
  border: `1px solid ${BRAND}`,
}

const labelStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
}

const stepNumStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  margin: '0 0 2px',
}

const stepTitleStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 13,
  fontWeight: 600,
  color: '#111111',
  margin: '0 0 2px',
}

const stepBodyStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 13,
  color: '#52525b',
  lineHeight: '20px',
  margin: 0,
}
