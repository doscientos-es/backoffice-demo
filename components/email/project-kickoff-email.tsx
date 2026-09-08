import { Button, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const BODY: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: 14,
  lineHeight: '22px',
  margin: '0 0 14px',
}

export type ProjectKickoffEmailProps = {
  clientName: string
  projectName: string
  portalUrl: string
  appUrl: string
  message?: string
}

export function ProjectKickoffEmail({
  clientName,
  projectName,
  portalUrl,
  appUrl,
  message,
}: ProjectKickoffEmailProps) {
  return (
    <EmailLayout preview={`Tu proyecto ${projectName} ya está en marcha`} appUrl={appUrl}>
      <Text style={{ ...BODY, color: '#171717', fontSize: 20, fontWeight: 600 }}>
        Arrancamos, {clientName}
      </Text>
      <Text style={BODY}>
        El proyecto <strong>{projectName}</strong> ya está en marcha. Hemos preparado un espacio
        privado para que puedas seguir su evolución desde un único lugar.
      </Text>
      {message ? <Text style={{ ...BODY, fontStyle: 'italic' }}>{message}</Text> : null}
      <Text style={BODY}>
        En el portal encontrarás el progreso, las próximas fechas, las tareas compartidas y un canal
        para enviarnos solicitudes.
      </Text>
      <Button
        href={portalUrl}
        style={{
          backgroundColor: BRAND,
          borderRadius: 8,
          boxSizing: 'border-box',
          color: '#ffffff',
          display: 'block',
          fontSize: 14,
          fontWeight: 600,
          padding: '14px 0',
          textAlign: 'center',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        Ver seguimiento del proyecto
      </Button>
      <Text style={{ ...BODY, color: '#71717a', fontSize: 12, margin: '18px 0 0' }}>
        Este enlace es privado. No lo compartas con personas ajenas al proyecto.
      </Text>
    </EmailLayout>
  )
}
