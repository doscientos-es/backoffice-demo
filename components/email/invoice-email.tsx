import { Button, Hr, Section, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const FONT_STACK = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type InvoiceEmailProps = {
  /** Recipient client name, e.g. "Acme S.L." */
  clientName: string
  /** Full invoice number, e.g. "A-000042" */
  invoiceNumber: string
  /** Formatted total string, e.g. "1.250,00 €" */
  total: string
  /** Formatted due date, e.g. "15 de junio de 2026" */
  dueDate: string
  /** Absolute URL to the public portal invoice page */
  portalUrl: string
  /** Absolute base URL of the app (for logo resolution) */
  appUrl: string
  /** Optional custom message from the sender */
  message?: string
}

/**
 * Transactional email sent to the client when an invoice is issued.
 *
 * Usage:
 *   const html = await renderEmail(<InvoiceEmail {...props} />);
 *   await sendEmail({ ..., subject: `Factura ${invoiceNumber}`, html });
 */
export function InvoiceEmail({
  clientName,
  invoiceNumber,
  total,
  dueDate,
  portalUrl,
  appUrl,
  message,
}: InvoiceEmailProps) {
  return (
    <EmailLayout
      preview={`Factura ${invoiceNumber} · ${total} · Vence el ${dueDate}`}
      appUrl={appUrl}
    >
      {/* Greeting */}
      <Text style={headingStyle}>Hola, {clientName}</Text>
      <Text style={bodyStyle}>
        Te enviamos la factura <strong>{invoiceNumber}</strong> por importe de{' '}
        <strong>{total}</strong>. Puedes consultarla, descargarla y pagarla online de forma segura
        desde el enlace de abajo.
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
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Nº factura</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{invoiceNumber}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Importe total</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{total}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Fecha de vencimiento</Text>
        <Text style={{ ...valueStyle, marginBottom: 0 }}>{dueDate}</Text>
      </Section>

      {/* CTA */}
      <Button
        href={portalUrl}
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
        Ver y pagar
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
