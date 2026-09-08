import { Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BODY: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: 14,
  lineHeight: '22px',
  margin: '0 0 14px',
}

export type ProposalAcceptedEmailProps = {
  clientName: string
  proposalTitle: string
  appUrl: string
}

export function ProposalAcceptedEmail({
  clientName,
  proposalTitle,
  appUrl,
}: ProposalAcceptedEmailProps) {
  return (
    <EmailLayout preview={`Hemos recibido tu aprobación para ${proposalTitle}`} appUrl={appUrl}>
      <Text style={{ ...BODY, color: '#171717', fontSize: 20, fontWeight: 600 }}>
        Gracias, {clientName}
      </Text>
      <Text style={BODY}>
        Hemos recibido la aprobación de la propuesta <strong>{proposalTitle}</strong> y ya estamos
        preparando el arranque del proyecto.
      </Text>
      <Text style={BODY}>
        En cuanto el espacio de seguimiento esté listo, recibirás otro email con tu enlace privado.
        Allí podrás consultar el avance, las fechas y enviarnos solicitudes.
      </Text>
      <Text style={{ ...BODY, color: '#71717a', fontSize: 12, marginBottom: 0 }}>
        No necesitas hacer nada más por ahora. Si tienes alguna pregunta, responde directamente a
        este email.
      </Text>
    </EmailLayout>
  )
}
