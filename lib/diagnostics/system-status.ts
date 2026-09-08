
/**
 * Read-only snapshot of which integrations are configured, for the
 * Ajustes → Diagnóstico page.
 *
 * SAFETY: this module never returns secret values — only booleans and
 * non-sensitive scalars (domains, environment names, public URLs). Secrets
 * must never leave the server.
 */

export type SystemCheck = {
  key: string
  label: string
  configured: boolean
  /** Non-secret hint shown next to the badge (e.g. "Gemini", "modo mock"). */
  detail?: string
}

export type RuntimeInfo = { key: string; label: string; value: string }

export type SystemStatus = {
  integrations: SystemCheck[]
  runtime: RuntimeInfo[]
}

export function getSystemStatus(): SystemStatus {
  const integrations: SystemCheck[] = [
    {
      key: 'local-data',
      label: 'Datos locales',
      configured: true,
    },
    { key: 'email', label: 'Email', configured: false, detail: 'modo mock' },
    { key: 'calendar', label: 'Calendario', configured: false, detail: 'modo mock' },
    { key: 'ai', label: 'Asistente IA', configured: false, detail: 'modo mock' },
    { key: 'social', label: 'Redes sociales', configured: false, detail: 'modo mock' },
    { key: 'billing', label: 'Facturación externa', configured: false, detail: 'modo mock' },
    { key: 'backups', label: 'Backups remotos', configured: false, detail: 'modo mock' },
  ]

  const runtime: RuntimeInfo[] = [
    { key: 'data_source', label: 'Origen de datos', value: 'JSON local versionado' },
    { key: 'network', label: 'Conexiones externas', value: 'Bloqueadas' },
    { key: 'mode', label: 'Modo', value: 'Demo pública' },
  ]

  return { integrations, runtime }
}
