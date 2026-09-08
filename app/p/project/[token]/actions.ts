'use server'

import { createHash } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { isPortalUnlocked, unlockPortalResource } from '@/lib/portal/access'
import { distributedRateLimit } from '@/lib/ratelimit'
import { SubmitProjectRequestInput } from '@/lib/schemas/project-portal'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function unlockProjectPortal(input: unknown): Promise<ActionResult> {
  return unlockPortalResource('projects', input)
}

export async function submitProjectRequest(input: unknown): Promise<ActionResult> {
  const parsed = SubmitProjectRequestInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  }
  if (parsed.data.website) return { ok: true }

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('portal_password_hash, is_client_visible')
    .eq('portal_token', parsed.data.token)
    .is('deleted_at', null)
    .maybeSingle()
  if (!project || project.is_client_visible === false) {
    return { ok: false, error: 'Proyecto no disponible' }
  }
  if (
    !(await isPortalUnlocked(
      parsed.data.token,
      (project.portal_password_hash as string | null) ?? null,
    ))
  ) {
    return { ok: false, error: 'Vuelve a introducir la contraseña del portal' }
  }

  const requestHeaders = await headers()
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const portalKey = createHash('sha256').update(parsed.data.token).digest('hex').slice(0, 16)
  const limit = await distributedRateLimit(`project-request:${portalKey}:${ip}`, 5, 600)
  if (!limit.success) {
    return { ok: false, error: 'Has enviado demasiadas solicitudes. Inténtalo más tarde.' }
  }

  const { error } = await admin.rpc('submit_project_request', {
    p_portal_token: parsed.data.token,
    p_category: parsed.data.category,
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
    p_requester_name: parsed.data.requesterName,
    p_requester_email: parsed.data.requesterEmail || null,
  })
  if (error) return { ok: false, error: 'No se pudo enviar la solicitud' }

  revalidatePath(`/p/project/${parsed.data.token}`)
  return { ok: true }
}
