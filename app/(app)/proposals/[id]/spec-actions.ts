'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import {
  CreateProposalSpecInput,
  ProposalSpecIdInput,
  ToggleProposalSpecVisibilityInput,
  UpdateProposalSpecInput,
} from '@/lib/schemas/proposal'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('proposals.specs')

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string; code?: 'conflict' }

/**
 * Creates a proposal_spec linked to a proposal. Returns the new id so the
 * caller can navigate to it / open the editor.
 */
export async function createSpec(input: unknown): Promise<Result<{ id: string }>> {
  const user = await requireUser()
  const parsed = CreateProposalSpecInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const data = parsed.data

  const supabase = await createServerClient()

  // Confirm the parent proposal exists and pick up project_id / client_id.
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, project_id, client_id')
    .eq('id', data.proposal_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!proposal) return { ok: false, error: 'Propuesta no encontrada' }

  const { data: doc, error } = await supabase
    .from('proposal_specs')
    .insert({
      title: data.title,
      body_markdown: data.body_markdown,
      proposal_id: data.proposal_id,
      project_id: (proposal as { project_id: string | null }).project_id,
      client_id: (proposal as { client_id: string }).client_id,
      is_client_visible: data.is_client_visible,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !doc) {
    log.error({ err: error, proposalId: data.proposal_id }, 'create_spec_failed')
    return { ok: false, error: error?.message ?? 'No se pudo crear la documentación' }
  }

  revalidatePath(`/proposals/${data.proposal_id}`)
  return { ok: true, id: doc.id as string }
}

export async function updateSpec(input: unknown): Promise<Result<{ version: number }>> {
  await requireUser()
  const parsed = UpdateProposalSpecInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const { id, expected_version, ...rest } = parsed.data

  const patch: Record<string, unknown> = {}
  if (rest.title !== undefined) patch.title = rest.title
  if (rest.body_markdown !== undefined) patch.body_markdown = rest.body_markdown
  if (Object.keys(patch).length === 0) return { ok: true, version: expected_version }

  const supabase = await createServerClient()
  const { data: doc, error } = await supabase
    .from('proposal_specs')
    .update(patch)
    .eq('id', id)
    .eq('version', expected_version)
    .select('proposal_id, version')
    .maybeSingle()

  if (error) {
    log.error({ err: error, id }, 'update_spec_failed')
    return { ok: false, error: error.message }
  }
  if (!doc)
    return {
      ok: false,
      code: 'conflict',
      error: 'Este registro ha cambiado mientras lo editabas.',
    }
  const proposalId = (doc as { proposal_id: string | null }).proposal_id
  if (proposalId) revalidatePath(`/proposals/${proposalId}`)
  return { ok: true, version: Number(doc.version) }
}

export async function toggleSpecVisibility(input: unknown): Promise<Result<{ version: number }>> {
  await requireUser()
  const parsed = ToggleProposalSpecVisibilityInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Datos no válidos' }
  }
  const supabase = await createServerClient()
  const { data: doc, error } = await supabase
    .from('proposal_specs')
    .update({ is_client_visible: parsed.data.is_client_visible })
    .eq('id', parsed.data.id)
    .eq('version', parsed.data.expected_version)
    .select('proposal_id, version')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!doc)
    return {
      ok: false,
      code: 'conflict',
      error: 'Este registro ha cambiado mientras lo editabas.',
    }
  const proposalId = (doc as { proposal_id: string | null }).proposal_id
  if (proposalId) revalidatePath(`/proposals/${proposalId}`)
  return { ok: true, version: Number(doc.version) }
}

export async function deleteSpec(input: unknown): Promise<Result> {
  await requireUser()
  const parsed = ProposalSpecIdInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos no válidos' }
  const supabase = await createServerClient()
  const { data: doc } = await supabase
    .from('proposal_specs')
    .select('proposal_id')
    .eq('id', parsed.data.id)
    .maybeSingle()
  const { error } = await supabase.from('proposal_specs').delete().eq('id', parsed.data.id)
  if (error) return { ok: false, error: error.message }
  const proposalId = (doc as { proposal_id: string | null } | null)?.proposal_id
  if (proposalId) revalidatePath(`/proposals/${proposalId}`)
  return { ok: true }
}
