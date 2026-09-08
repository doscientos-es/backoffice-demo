import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'

import { EmailLogo } from './email-logo'

const FONT_STACK = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const BRAND = '#2A4227'

export type EmailLayoutProps = {
  /** One-line preview shown in inbox clients before opening the email. */
  preview: string
  appUrl: string
  children: ReactNode
}

/**
 * Base email wrapper. All transactional emails use this shell.
 *
 *   ┌───────────────────────────┐
 *   │      doscientos logo      │
 *   ├───────────────────────────┤
 *   │         content           │
 *   ├───────────────────────────┤
 *   │  footer · confidential    │
 *   └───────────────────────────┘
 */
export function EmailLayout({ preview, appUrl, children }: EmailLayoutProps) {
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f4f4f5',
          fontFamily: FONT_STACK,
          WebkitFontSmoothing: 'antialiased',
          margin: 0,
          padding: '40px 0',
        }}
      >
        <Container
          style={{
            maxWidth: 580,
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #e4e4e7',
          }}
        >
          {/* Header */}
          <Section
            style={{
              padding: '28px 40px 20px',
              borderBottom: '1px solid #e4e4e7',
            }}
          >
            <EmailLogo appUrl={appUrl} />
          </Section>

          {/* Content */}
          <Section style={{ padding: '32px 40px' }}>{children}</Section>

          {/* Footer */}
          <Section
            style={{
              padding: '0 40px 28px',
            }}
          >
            <Hr style={{ borderColor: '#e4e4e7', margin: '0 0 20px' }} />
            <Text
              style={{
                margin: 0,
                fontSize: 11,
                color: '#a1a1aa',
                textAlign: 'center',
                lineHeight: '16px',
              }}
            >
              <span style={{ color: BRAND, fontWeight: 600 }}>doscientos</span>
              {' · '}
              DOSCIENTOS DESARROLLO TECNOLÓGICO, S.L.
              <br />
              Este mensaje es confidencial y está dirigido exclusivamente al destinatario.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
