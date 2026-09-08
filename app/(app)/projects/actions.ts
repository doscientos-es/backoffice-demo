'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { ProjectKickoffEmail } from '@/components/email'
import { defineAction } from '@/lib/actions/define-action'
import { requireRole } from '@/lib/auth'
import { VersionConflictError } from '@/lib/concurrency/version-conflict'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { parseGithubRepoUrl } from '@/lib/integrations/github-sync'
import { buildPortalAccessPatch } from '@/lib/portal/access'
import { uuidIdInput } from '@/lib/schemas/common'
import { UpdatePortalAccessInput } from '@/lib/schemas/portal'
import {
  ProjectInput,
  UpdateProjectInput,
  UpdateProjectWorkspacePathsInput,
} from '@/lib/schemas/project'
import { createServerClient } from '@/lib/supabase/server'

// biome-ignore lint/suspicious/noExplicitAny: complex dynamic payload from form
function buildDbPayload(p: any) {
  const repo = p.github_repo ? parseGithubRepoUrl(p.github_repo) : null
  const isHourly = p.billing_type === 'hourly'
  return {
    client_id: p.client_id,
    name: p.name,
    description: p.description ?? null,
    status: p.status,
    starts_at: p.starts_at ?? null,
    ends_at: p.ends_at ?? null,
    billing_type: p.billing_type,
    hourly_rate: isHourly ? (p.hourly_rate ?? null) : null,
    hourly_vat_rate: isHourly ? p.hourly_vat_rate : 21,
    github_sync_mode: p.github_sync_mode,
    github_auto_sync: p.github_sync_mode === 'bidirectional' ? p.github_auto_sync : true,
    github_repo: p.github_sync_mode === 'none' ? null : (p.github_repo ?? null),
    github_repo_owner: p.github_sync_mode === 'none' ? null : (repo?.owner ?? null),
    github_repo_name: p.github_sync_mode === 'none' ? null : (repo?.name ?? null),
    github_installation_id:
      p.github_sync_mode === 'bidirectional' ? (p.github_installation_id ?? null) : null,
  }
}

export const createProject = defineAction({
  name: 'projects.create',
  schema: ProjectInput,
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('projects')
      .insert(buildDbPayload(input))
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'No se pudo crear el proyecto')

    // Apply onboarding template if requested
    if (input.template_id) {
      const { data: tplItems } = await supabase
        .from('onboarding_template_items')
        .select('label, position')
        .eq('template_id', input.template_id)
        .order('position')

      if (tplItems && tplItems.length > 0) {
        await supabase.from('project_checklist_items').insert(
          tplItems.map((item) => ({
            project_id: data.id,
            label: item.label as string,
            position: item.position as number,
          })),
        )
      }
    }

    revalidatePath('/projects')
    redirect(`/projects/${data.id}`)
  },
})

export const updateProject = defineAction({
  name: 'projects.update',
  schema: UpdateProjectInput,
  revalidate: (_payload, input) => ['/projects', `/projects/${input.id}`],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { id, expected_version } = input
    const { data, error } = await supabase
      .from('projects')
      .update(buildDbPayload(input))
      .eq('id', id)
      .eq('version', expected_version)
      .select('version')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new VersionConflictError()
    return { version: Number(data.version) }
  },
})

export const updateProjectWorkspacePaths = defineAction({
  name: 'projects.updateWorkspacePaths',
  schema: UpdateProjectWorkspacePathsInput,
  revalidate: (_payload, input) => [`/projects/${input.id}`],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('projects')
      .update({ workspace_paths: input.workspace_paths })
      .eq('id', input.id)
      .eq('version', input.expected_version)
      .select('version')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) throw new VersionConflictError()
    return { version: Number(data.version) }
  },
})

/**
 * Soft-deletes a project by stamping `deleted_at`. The list and detail
 * queries filter on `deleted_at is null`, so the row simply disappears
 * from the UI. Related proposals/invoices keep their `project_id` until
 * a hard delete occurs (FKs are `on delete set null`).
 */
export const deleteProject = defineAction({
  name: 'projects.delete',
  schema: uuidIdInput,
  revalidate: () => ['/projects'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)

    if (error) throw new Error(error.message)
  },
})

/**
 * Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
 * shown after `deleteProject`, returning the project to the UI.
 */
export const restoreProject = defineAction({
  name: 'projects.restore',
  schema: uuidIdInput,
  revalidate: (_payload, input) => [`/projects/${input.id}`, '/projects'],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', input.id)

    if (error) throw new Error(error.message)
  },
})

export async function updateProjectPortalAccess(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole(['owner', 'admin', 'member'])
  } catch {
    return { ok: false, error: 'No autorizado' }
  }
  const parsed = UpdatePortalAccessInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }
  }
  const patch = buildPortalAccessPatch(parsed.data)
  if (Object.keys(patch).length === 0) return { ok: true }

  const supabase = await createServerClient()
  const { error } = await supabase.from('projects').update(patch).eq('id', parsed.data.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/projects/${parsed.data.id}`)
  return { ok: true }
}

const PublishProjectPortalInput = z.object({
  id: z.string().uuid(),
  message: z.string().trim().max(1000, 'El mensaje es demasiado largo').optional(),
  resend: z.boolean().optional(),
})

export async function publishProjectPortal(input: unknown) {
  const user = await requireRole(['owner', 'admin'])
  const parsed = PublishProjectPortalInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, name, portal_token, is_client_visible, portal_invite_sent_at, portal_invite_recipient, portal_invite_resend_id, clients(name, email)',
    )
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return { ok: false as const, error: 'Proyecto no encontrado' }

  const project = data as unknown as {
    id: string
    name: string
    portal_token: string | null
    is_client_visible: boolean
    portal_invite_sent_at: string | null
    portal_invite_recipient: string | null
    portal_invite_resend_id: string | null
    clients: { name: string; email: string | null } | null
  }
  if (!project.portal_token)
    return { ok: false as const, error: 'El proyecto no tiene enlace público' }
  if (!project.clients?.email) return { ok: false as const, error: 'El cliente no tiene email' }
  if (project.portal_invite_sent_at && !parsed.data.resend) {
    return { ok: true as const, sentAt: project.portal_invite_sent_at, alreadySent: true }
  }

  const claimedAt = new Date().toISOString()
  let claim = supabase
    .from('projects')
    .update({
      is_client_visible: true,
      portal_invite_sent_at: claimedAt,
      portal_invite_recipient: project.clients.email,
      portal_invite_resend_id: null,
    })
    .eq('id', project.id)
  if (!parsed.data.resend) claim = claim.is('portal_invite_sent_at', null)
  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle()
  if (claimError || !claimed) {
    return { ok: false as const, error: 'El portal ya está siendo publicado' }
  }

  try {
    const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
    const portalUrl = `${appUrl}/p/project/${project.portal_token}`
    const html = await renderEmail(
      ProjectKickoffEmail({
        clientName: project.clients.name,
        projectName: project.name,
        portalUrl,
        appUrl,
        message: parsed.data.message || undefined,
      }),
    )
    const sent = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? user.email,
      to: project.clients.email,
      replyTo: user.email,
      subject: `Arrancamos con ${project.name}`,
      html,
      tags: { project_id: project.id, kind: 'project_kickoff' },
    })
    await supabase
      .from('projects')
      .update({ portal_invite_resend_id: sent.id })
      .eq('id', project.id)
      .eq('portal_invite_sent_at', claimedAt)
    revalidatePath(`/projects/${project.id}`)
    return { ok: true as const, sentAt: claimedAt }
  } catch {
    await supabase
      .from('projects')
      .update({
        is_client_visible: project.is_client_visible,
        portal_invite_sent_at: project.portal_invite_sent_at,
        portal_invite_recipient: project.portal_invite_recipient,
        portal_invite_resend_id: project.portal_invite_resend_id,
      })
      .eq('id', project.id)
      .eq('portal_invite_sent_at', claimedAt)
    return { ok: false as const, error: 'No se pudo enviar el email. El portal no se publicó.' }
  }
}
