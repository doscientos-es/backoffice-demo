import { Row, Section, Text } from '@react-email/components'

export type EmailLogoProps = {
  /**
   * Absolute base URL of the app. Kept for API compatibility with callers,
   * currently unused since the header renders a text-only wordmark.
   */
  appUrl?: string
}

/**
 * Horizontally centered brand lockup for email headers.
 *
 * Renders a plain text wordmark instead of an <Img>: email clients (Gmail,
 * Outlook, Apple Mail) either strip SVGs or fail to load images hosted behind
 * a non-public origin (e.g. localhost in dev), which left a broken image at the
 * top of every email. A styled text wordmark renders reliably everywhere.
 */
export function EmailLogo(_props: EmailLogoProps) {
  return (
    <Section style={{ paddingBottom: 0 }}>
      <Row>
        <td align="center">
          <Text
            style={{
              margin: 0,
              fontFamily:
                "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#2A4227',
            }}
          >
            doscientos
          </Text>
        </td>
      </Row>
    </Section>
  )
}
