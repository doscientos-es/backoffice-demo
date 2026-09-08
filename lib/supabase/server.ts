import { createLocalDataClient } from '@/lib/demo/local-data'

/**
 * Server Component / Server Action / Route Handler Supabase client.
 * Uses the user's session cookies (RLS enforced).
 */
export async function createServerClient() {
  return createLocalDataClient()
}
