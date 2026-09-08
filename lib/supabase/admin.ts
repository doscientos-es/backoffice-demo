import { createLocalDataClient } from '@/lib/demo/local-data'

type GenerateAuthLinkOptions = {
  type: 'invite' | 'recovery' | 'magiclink' | 'signup'
  email: string
  data?: Record<string, unknown>
  redirectTo?: string
}

type GeneratedAuthLink = {
  user: { id: string } | null
  properties: { hashed_token: string } | null
}

/**
 * Calls GoTrue directly because the installed JS client does not expose
 * auth.admin.generateLink, while self-hosted Supabase still supports the
 * official /auth/v1/admin/generate_link endpoint.
 */
export async function generateAuthLink(
  _options: GenerateAuthLinkOptions,
): Promise<{ data: GeneratedAuthLink | null; error: { message: string; status?: number } | null }> {
  return { data: null, error: { message: 'Autenticación desactivada en la demo' } }
}

/**
 * Service-role Supabase client. NEVER expose to the browser.
 * Use only inside Server Actions and route handlers that need
 * to bypass RLS (e.g. public portal endpoints, webhooks).
 */
export function createAdminClient() {
  return createLocalDataClient()
}
