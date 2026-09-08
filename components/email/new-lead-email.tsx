import { Button, Hr, Section, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type NewLeadEmailProps = {
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  leadCompany: string | null
  leadSource: string
  /** Absolute URL to the lead detail page in the backoffice. */
  leadUrl: string
  /** Absolute base URL of the app (for logo resolution). */
  appUrl: string
}

/**
 * Internal transactional email sent to every admin/owner when a new lead is ingested.
 *
 * Usage:
 *   const html = await renderEmail(NewLeadEmail({ ...props }));
 *   await sendEmail({ fromName: "doscientos", fromAlias: "notificaciones", ..., html });
 */
export function NewLeadEmail({
  leadName,
  leadEmail,
  leadPhone,
  leadCompany,
  leadSource,
  leadUrl,
  appUrl,
}: NewLeadEmailProps) {
  return (
    <EmailLayout
      preview={`Nuevo lead: ${leadName}${leadCompany ? ` · ${leadCompany}` : ''}`}
      appUrl={appUrl}
    >
      <Text style={headingStyle}>Nuevo lead recibido</Text>
      <Text style={bodyStyle}>
        Acaba de entrar un nuevo lead. Revísalo y contacta cuanto antes.
      </Text>

      {/* Lead summary card */}
      <Section
        style={{
          backgroundColor: '#f4f4f5',
          borderRadius: 8,
          padding: '16px 20px',
          margin: '24px 0',
        }}
      >
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Nombre</Text>
        <Text style={{ ...valueStyle, marginBottom: leadCompany ? 12 : 0 }}>{leadName}</Text>

        {leadCompany ? (
          <>
            <Text style={{ ...labelStyle, marginBottom: 4 }}>Empresa</Text>
            <Text style={{ ...valueStyle, marginBottom: 0 }}>{leadCompany}</Text>
          </>
        ) : null}

        {leadEmail || leadPhone ? (
          <>
            <Hr style={{ borderColor: '#e4e4e7', margin: '12px 0' }} />
            {leadEmail ? (
              <>
                <Text style={{ ...labelStyle, marginBottom: 4 }}>Email</Text>
                <Text style={{ ...valueStyle, marginBottom: leadPhone ? 12 : 0 }}>{leadEmail}</Text>
              </>
            ) : null}
            {leadPhone ? (
              <>
                <Text style={{ ...labelStyle, marginBottom: 4 }}>Teléfono</Text>
                <Text style={{ ...valueStyle, marginBottom: 0 }}>{leadPhone}</Text>
              </>
            ) : null}
          </>
        ) : null}

        <Hr style={{ borderColor: '#e4e4e7', margin: '12px 0' }} />
        <Text style={{ ...labelStyle, marginBottom: 4 }}>Fuente</Text>
        <Text style={{ ...valueStyle, marginBottom: 0 }}>{leadSource}</Text>
      </Section>

      {/* CTA */}
      <Button
        href={leadUrl}
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
        Ver lead
      </Button>

      <Hr style={{ borderColor: '#e4e4e7', margin: '28px 0 16px' }} />
      <Text style={{ ...bodyStyle, color: '#a1a1aa', fontSize: 12 }}>
        Este aviso se envía automáticamente a los administradores cuando entra un lead nuevo.
      </Text>
    </EmailLayout>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

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
