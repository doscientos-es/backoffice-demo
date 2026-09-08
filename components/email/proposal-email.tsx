import { Button, Hr, Section, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type ProposalEmailSpec = {
  /** Display title of the technical-spec document. */
  title: string
  /** Absolute URL to /p/spec/[token]. */
  url: string
}

export type ProposalEmailProps = {
  /** Recipient client name, e.g. "Acme S.L." */
  clientName: string
  /** Proposal title, e.g. "Desarrollo web corporativo" */
  proposalTitle: string
  /** Proposal number, e.g. "P-2026-007" */
  proposalNumber: string
  /** Formatted total string, e.g. "8.500,00 €" */
  total: string
  /** Formatted valid-until date, e.g. "30 de junio de 2026". Optional. */
  validUntil?: string
  /** Absolute URL to the public portal proposal page */
  portalUrl: string
  /** Absolute URL to the deck/presentation page. Optional. */
  deckUrl?: string
  /** Absolute base URL of the app (for logo resolution) */
  appUrl: string
  /** Optional custom message from the sender */
  message?: string
  /** Optional client-visible technical specs to surface as secondary CTAs. */
  specs?: ProposalEmailSpec[]
}

/**
 * Transactional email sent to the client when a proposal is shared.
 *
 * Usage:
 *   const html = await renderEmail(<ProposalEmail {...props} />);
 *   await sendEmail({ ..., subject: `Propuesta ${proposalNumber}`, html });
 */
export function ProposalEmail({
  clientName,
  proposalTitle,
  proposalNumber,
  total,
  validUntil,
  portalUrl,
  deckUrl,
  appUrl,
  message,
  specs,
}: ProposalEmailProps) {
  const hasSpecs = Array.isArray(specs) && specs.length > 0
  return (
    <EmailLayout
      preview={`Propuesta ${proposalNumber} · ${proposalTitle} · ${total}`}
      appUrl={appUrl}
    >
      {/* Greeting */}
      <Text style={headingStyle}>Hola, {clientName}</Text>
      <Text style={bodyStyle}>
        Te enviamos nuestra propuesta <strong>{proposalTitle}</strong>. Puedes revisarla, hacer
        preguntas y aceptarla o rechazarla directamente desde el siguiente enlace.
      </Text>

      {/* Optional custom message */}
      {message ? <Text style={{ ...bodyStyle, fontStyle: 'italic' }}>{message}</Text> : null}

      {/* Summary card */}
      <Section
        style={{
          backgroundColor: '#f4f4f5',
          borderRadius: 8,
          padding: '16px 20px',
          margin: '24px 0',
        }}
      >
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Propuesta</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{proposalTitle}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Referencia</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{proposalNumber}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Importe total</Text>
        <Text style={{ ...valueStyle, marginBottom: validUntil ? 12 : 0 }}>{total}</Text>
        {validUntil ? (
          <>
            <Text style={{ ...labelStyle, marginBottom: 4 }}>Válida hasta</Text>
            <Text style={{ ...valueStyle, marginBottom: 0 }}>{validUntil}</Text>
          </>
        ) : null}
      </Section>

      {/* CTA */}
      <Button
        href={portalUrl}
        style={{
          display: 'block',
          width: '100%',
          backgroundColor: BRAND,
          color: '#ffffff',
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'center',
          textDecoration: 'none',
          borderRadius: 8,
          padding: '14px 0',
          boxSizing: 'border-box',
        }}
      >
        Ver propuesta
      </Button>

      {deckUrl ? (
        <Button
          href={deckUrl}
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: '#ffffff',
            color: BRAND,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            textDecoration: 'none',
            border: `1px solid ${BRAND}`,
            borderRadius: 8,
            padding: '12px 0',
            boxSizing: 'border-box',
            marginTop: 8,
          }}
        >
          Ver presentación
        </Button>
      ) : null}

      {hasSpecs ? (
        <>
          <Hr style={{ borderColor: '#e4e4e7', margin: '28px 0 16px' }} />
          <Text style={{ ...labelStyle, marginBottom: 8 }}>Documentación técnica</Text>
          <Text style={{ ...bodyStyle, marginBottom: 12 }}>
            Adjuntamos también la documentación técnica de este proyecto:
          </Text>
          {specs!.map((spec) => (
            <Button
              key={spec.url}
              href={spec.url}
              style={{
                display: 'block',
                width: '100%',
                backgroundColor: '#ffffff',
                color: BRAND,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
                border: `1px solid ${BRAND}`,
                borderRadius: 8,
                padding: '12px 0',
                boxSizing: 'border-box',
                marginBottom: 8,
              }}
            >
              {spec.title}
            </Button>
          ))}
        </>
      ) : null}

      <Hr style={{ borderColor: '#e4e4e7', margin: '28px 0 16px' }} />
      <Text style={{ ...bodyStyle, color: '#a1a1aa', fontSize: 12 }}>
        Si tienes cualquier pregunta o necesitas ajustes, responde a este email.
      </Text>
    </EmailLayout>
  )
}

// ── Shared styles ────────────────────────────────────────────────────────────
const headingStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 600,
  color: '#111111',
  margin: '0 0 12px',
  letterSpacing: '-0.02em',
}

const bodyStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  color: '#3f3f46',
  lineHeight: '22px',
  margin: '0 0 12px',
}

const labelStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 600,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: 0,
}

const valueStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 600,
  color: '#111111',
  margin: 0,
}
