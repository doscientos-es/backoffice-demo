import { Button, Hr, Section, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const FONT_STACK = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type PaymentReceiptEmailProps = {
  /** Recipient client name, e.g. "Acme S.L." */
  clientName: string
  /** Proposal number, e.g. "P-2026-007" */
  proposalNumber: string
  /** Proposal title, e.g. "Desarrollo web corporativo" */
  proposalTitle: string
  /** Formatted amount paid, e.g. "60,50 €" */
  amount: string
  /** Formatted payment date, e.g. "25 de junio de 2026" */
  paymentDate: string
  /** Redsys operation reference shown on the receipt */
  reference: string
  /** Absolute URL to the public receipt page */
  receiptUrl: string
  /** Absolute base URL of the app (for logo resolution) */
  appUrl: string
}

/**
 * Transactional email sent to the client when a proposal deposit ("paga y
 * señal") is confirmed, linking to the public payment receipt.
 *
 * Usage:
 *   const html = await renderEmail(<PaymentReceiptEmail {...props} />);
 *   await sendEmail({ ..., subject: `Pago confirmado · ${proposalNumber}`, html });
 */
export function PaymentReceiptEmail({
  clientName,
  proposalNumber,
  proposalTitle,
  amount,
  paymentDate,
  reference,
  receiptUrl,
  appUrl,
}: PaymentReceiptEmailProps) {
  return (
    <EmailLayout preview={`Pago confirmado · ${amount} · ${proposalNumber}`} appUrl={appUrl}>
      {/* Greeting */}
      <Text style={headingStyle}>Hola, {clientName}</Text>
      <Text style={bodyStyle}>
        Hemos recibido correctamente tu pago de <strong>{amount}</strong> correspondiente a la
        propuesta <strong>{proposalTitle}</strong>. Adjuntamos el justificante, que puedes consultar
        y descargar desde el enlace de abajo.
      </Text>

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
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{proposalNumber}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Importe abonado</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{amount}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Fecha de pago</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{paymentDate}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Referencia</Text>
        <Text style={{ ...valueStyle, marginBottom: 0 }}>{reference}</Text>
      </Section>

      {/* CTA */}
      <Button
        href={receiptUrl}
        style={{
          display: 'block',
          width: '100%',
          backgroundColor: BRAND,
          color: '#ffffff',
          fontFamily: FONT_STACK,
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'center',
          textDecoration: 'none',
          borderRadius: 8,
          padding: '14px 0',
          boxSizing: 'border-box',
        }}
      >
        Ver justificante
      </Button>

      <Hr style={{ borderColor: '#e4e4e7', margin: '28px 0 16px' }} />
      <Text style={{ ...bodyStyle, color: '#a1a1aa', fontSize: 12 }}>
        Si tienes cualquier duda, responde a este email y te atenderemos encantados.
      </Text>
    </EmailLayout>
  )
}

// ── Shared styles ────────────────────────────────────────────────────────────
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

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
