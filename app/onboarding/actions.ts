'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { ok: true } | { ok: false; error: string }

const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/

const OnboardingInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(160, 'El nombre no puede superar 160 caracteres'),
  github_handle: z
    .string()
    .trim()
    .max(39, 'El handle no puede superar 39 caracteres')
    .regex(GITHUB_HANDLE_RE, 'Handle de GitHub inválido (solo letras, números y guiones)')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  email_alias: z
    .string()
    .trim()
    .email('Introduce un email válido como alias de envío')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: z
    .string()
    .trim()
    .max(30, 'El teléfono no puede superar 30 caracteres')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

/**
 * Mark the team_member as onboarded and persist the optional profile data
 * the user filled in during the wizard. Idempotent: calling it twice does
 * nothing harmful since `onboarded_at` is monotonic.
 */
export async function completeOnboarding(formData: FormData): Promise<ActionResult> {
  const user = await requireUser({ allowUnonboarded: true })

  const parsed = OnboardingInput.safeParse({
    name: formData.get('name')?.toString() ?? '',
    github_handle: formData.get('github_handle')?.toString() ?? '',
    email_alias: formData.get('email_alias')?.toString() ?? '',
    phone: formData.get('phone')?.toString() ?? '',
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  // Use the admin client (bypasses RLS) because the RLS UPDATE policy on
  // team_members is restricted to owner/admin only. Members updating their
  // own onboarding row must go through the service-role client; the requireUser
  // guard above already ensures the caller is an authenticated team member.
  const supabase = createAdminClient()
  const githubHandle = parsed.data.github_handle ?? null

  // We never write the GitHub avatar into `avatar_url`. Priority is
  // Google (synced to `avatar_url` in /auth/callback) → GitHub (derived from
  // `github_handle` at render via `memberAvatarUrl`) → none. Persisting the
  // GitHub avatar here would clobber the Google photo and break that order.
  const { error } = await supabase
    .from('team_members')
    .update({
      name: parsed.data.name,
      github_handle: githubHandle,
      email_alias: parsed.data.email_alias ?? null,
      phone: parsed.data.phone ?? null,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    // Unique constraint on github_handle — another member already has it.
    if (error.code === '23505' && error.message.includes('github_handle')) {
      return { ok: false, error: 'Ese handle de GitHub ya lo usa otro miembro del equipo.' }
    }
    return { ok: false, error: 'No se pudo guardar el perfil. Inténtalo de nuevo.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Skip onboarding without saving extra profile data. Still marks
 * `onboarded_at` so the user is not prompted again next session.
 */
export async function skipOnboarding(): Promise<void> {
  const user = await requireUser({ allowUnonboarded: true })
  // Same rationale as completeOnboarding: admin client needed to bypass the
  // owner/admin-only RLS UPDATE policy on team_members.
  const supabase = createAdminClient()
  await supabase
    .from('team_members')
    .update({ onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', user.id)
  revalidatePath('/', 'layout')
  redirect('/inicio')
}
