import { Link, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

export function ProposalMessageEmail({
  clientName,
  proposalTitle,
  portalUrl,
  appUrl,
}: {
  clientName: string
  proposalTitle: string
  portalUrl: string
  appUrl: string
}) {
  return (
    <EmailLayout preview={`Hemos respondido a tu consulta sobre ${proposalTitle}`} appUrl={appUrl}>
      <Text style={{ fontSize: 20, fontWeight: 600, margin: '0 0 16px' }}>Hola, {clientName}</Text>
      <Text style={{ color: '#52525b', fontSize: 15, lineHeight: '24px', margin: 0 }}>
        Hemos respondido a tu consulta sobre la propuesta <strong>{proposalTitle}</strong>.
      </Text>
      <Link
        href={portalUrl}
        style={{
          color: '#2A4227',
          display: 'inline-block',
          fontSize: 15,
          fontWeight: 600,
          marginTop: 20,
        }}
      >
        Ver la respuesta en la propuesta →
      </Link>
    </EmailLayout>
  )
}
