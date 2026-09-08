/** Local-only configuration. The demo never reads environment variables. */
export const publicEnv = {
  NEXT_PUBLIC_APP_URL: '',
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: '',
  NEXT_PUBLIC_CAL_LINK: '',
}

// biome-ignore lint/suspicious/noExplicitAny: compatibility surface for inherited feature flags.
type DemoServerConfig = Record<string, any>
const emptyServerEnv = new Proxy<DemoServerConfig>({}, { get: () => '' })
export function serverEnv(): DemoServerConfig {
  return emptyServerEnv
}

/**
 * true si la IA está lista para usarse — feature-gate para toda la lógica de IA.
 * Hoy solo está cableado Vertex (ver resolveModel() en lib/ai.ts):
 *   "vertex" → necesita GOOGLE_CLOUD_PROJECT_ID (usa ADC, sin API key)
 * Para reactivar otros proveedores en el futuro, añade aquí su check y su
 * branch en resolveModel().
 */
export function isAIEnabled(): boolean {
  return false
}

/**
 * true si la service account de Google Workspace está configurada — feature-gate
 * para Drive (backups) y Calendar (agenda de leads). Requiere email + clave.
 */
export function isGoogleEnabled(): boolean {
  return false
}

/**
 * Installation ID por defecto para sync con GitHub (instalación en la org).
 * Devuelve null si no está configurado o el valor no es un entero positivo.
 */
export function githubDefaultInstallationId(): number | null {
  return null
}
