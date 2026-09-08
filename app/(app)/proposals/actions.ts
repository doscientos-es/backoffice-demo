'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { ProposalEmail } from '@/components/email'
import { requireRole, requireUser } from '@/lib/auth'
import {
  ensureClientForProposal,
  ensureProjectForProposal,
  hasCompleteFiscalData,
  promoteLeadFromClient,
} from '@/lib/crm/conversion'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { publicEnv } from '@/lib/env'
import { backupProposalToDrive } from '@/lib/google/backup'
import { sendProposalAcceptedEmail } from '@/lib/integrations/send-proposal-accepted-email'
import { createProposalDraftInvoices } from '@/lib/invoices/proposal-drafts'
import { buildLeadStatusPatch } from '@/lib/leads/status-transitions'
import { scopedLogger } from '@/lib/logger'
import { buildPortalAccessPatch } from '@/lib/portal/access'
import {
  buildProposalItemRows,
  buildProposalTotalsPatch,
  isProposalEditable,
} from '@/lib/proposals/items'
import { parseMaintenanceOffer, selectedMaintenancePlan } from '@/lib/proposals/maintenance'
import { parsePaymentPlan } from '@/lib/proposals/scope'
import { formatProposalValidationIssues } from '@/lib/proposals/validation'
import { UpdatePortalAccessInput } from '@/lib/schemas/portal'
import {
  AcceptProposalFiscalData,
  CreateProposalInput,
  DuplicateProposalInput,
  SendProposalPreviewInput,
  UpdateProposalInput,
  UpdateProposalPaymentPlanInput,
  UpdateProposalTeamInput,
} from '@/lib/schemas/proposal'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

const log = scopedLogger('proposals')

const PRE_QUOTE_LEAD_STATUSES = new Set(['new', 'contacted', 'in_conversation', 'qualifying'])

/**
 * Completes the CRM side of a first proposal delivery. A draft is internal;
 * only a proposal that has actually been sent puts its linked lead in the
 * Presupuestado stage. It also leaves a durable follow-up in the sender's
 * work queue after 72 hours.
 */
async function completeProposalDelivery(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  proposal: { id: string; title: string; lead_id: string | null; client_id: string | null },
  userId: string,
): Promise<string | null> {
  const { error: reminderError } = await supabase.from('tasks').insert({
    kind: 'reminder',
    title: `Seguimiento de propuesta · ${proposal.title}`,
    description: 'Revisar respuesta del cliente 72 horas después del envío.',
    start_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    lead_id: proposal.lead_id,
    client_id: proposal.client_id,
    created_by: userId,
    assignee_id: userId,
    status: 'todo',
    priority: 'high',
  })
  if (reminderError) {
    log.warn({ err: reminderError, proposalId: proposal.id }, 'proposal_follow_up_reminder_failed')
  }

  if (!proposal.lead_id) return null
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('status')
    .eq('id', proposal.lead_id)
    .maybeSingle()
  if (leadError || !lead || !PRE_QUOTE_LEAD_STATUSES.has(lead.status as string)) {
    if (leadError)
      log.warn({ err: leadError, proposalId: proposal.id }, 'proposal_lead_read_failed')
    return proposal.lead_id
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('leads')
    .update(buildLeadStatusPatch({ status: 'quoted', userId, now }))
    .eq('id', proposal.lead_id)
  if (updateError) {
    log.warn({ err: updateError, proposalId: proposal.id }, 'proposal_lead_quote_sync_failed')
    return proposal.lead_id
  }

  const { error: interactionError } = await supabase.from('lead_interactions').insert({
    lead_id: proposal.lead_id,
    type: 'status_change',
    subject: `Estado: ${lead.status as string} → quoted`,
    performed_by: userId,
    payload: { from: lead.status as string, to: 'quoted', proposal_id: proposal.id },
  })
  if (interactionError) {
    log.warn(
      { err: interactionError, proposalId: proposal.id },
      'proposal_lead_quote_interaction_failed',
    )
  }
  return proposal.lead_id
}

/**
 * Allocates the next sequential proposal number for the current year. Called
 * only at the first transition to `sent` so drafts don't consume numbers in
 * the legal series.
 */
async function nextProposalNumber(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `P-${year}-`
  const { data } = await supabase
    .from('proposals')
    .select('number')
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.number as string | undefined
  const lastSeq = last ? Number.parseInt(last.slice(prefix.length), 10) || 0 : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

/**
 * Shared insert path used by both the FormData and JSON entry points. The
 * proposal lands as a draft without a number — numbers are assigned on the
 * first transition to `sent` via `sendPreviewLink`.
 */
async function insertDraftProposal(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  data: import('@/lib/schemas/proposal').CreateProposalInputType,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const totals = buildProposalTotalsPatch(data.items)

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      client_id: data.client_id ?? null,
      lead_id: data.lead_id ?? null,
      project_id: data.project_id ?? null,
      number: null,
      title: data.title,
      status: 'draft',
      currency: 'EUR',
      ...totals,
      valid_until: data.valid_until ?? null,
      notes: data.notes ?? null,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error || !proposal) {
    log.error({ err: error }, 'create_proposal_failed')
    return { ok: false, error: error?.message ?? 'No se pudo crear la propuesta' }
  }

  const { error: itemsError } = await supabase
    .from('proposal_items')
    .insert(buildProposalItemRows(data.items, proposal.id))
  if (itemsError) {
    log.error({ err: itemsError, proposalId: proposal.id }, 'create_proposal_items_failed')
    return { ok: false, error: itemsError.message }
  }

  return { ok: true, id: proposal.id as string }
}

export async function createProposal(formData: FormData): Promise<void> {
  const user = await requireUser()

  const itemsRaw = formData.get('items')?.toString() ?? '[]'
  let items: unknown
  try {
    items = JSON.parse(itemsRaw)
  } catch {
    throw new Error('Líneas no válidas')
  }

  const parsed = CreateProposalInput.safeParse({
    client_id: formData.get('client_id')?.toString() ?? '',
    lead_id: formData.get('lead_id')?.toString() ?? '',
    title: formData.get('title')?.toString() ?? '',
    valid_until: formData.get('valid_until')?.toString() ?? '',
    notes: formData.get('notes')?.toString() ?? '',
    items,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Datos no válidos')
  }

  const supabase = await createServerClient()
  const res = await insertDraftProposal(supabase, user.id, parsed.data)
  if (!res.ok) throw new Error(res.error)

  revalidatePath('/proposals')
  redirect(`/proposals/${res.id}`)
}

/**
 * JSON version of createProposal for use with autosave or client-side calls.
 * Returns the created proposal ID on success.
 */
export async function createProposalAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser()

  const parsed = CreateProposalInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const supabase = await createServerClient()
  const res = await insertDraftProposal(supabase, user.id, parsed.data)
  if (!res.ok) return res

  revalidatePath('/proposals')
  return { ok: true, id: res.id }
}

/**
 * Clones an existing proposal as a new draft. Resets status, portal token,
 * number, timestamps and signature data; copies title (prefixed "Copia de"),
 * target, narrative blocks, commercial terms and line items. Useful for
 * re-quoting after a rejection or when iterating with the same client.
 */
export async function duplicateProposal(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser()

  const parsed = DuplicateProposalInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Identificador no válido' }
  }

  const supabase = await createServerClient()
  const { data: source, error: readError } = await supabase
    .from('proposals')
    .select(
      'client_id, lead_id, title, valid_until, notes, context_markdown, problems, solutions, terms, scope_modules, deliverables, acceptance_criteria, payment_schedule, payment_terms, change_management_terms, subtotal, tax_amount, total, currency',
    )
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (readError || !source) return { ok: false, error: 'Propuesta no encontrada' }

  const { data: items, error: itemsErr } = await supabase
    .from('proposal_items')
    .select('position, description, quantity, unit_price, vat_rate, billing_cycle')
    .eq('proposal_id', parsed.data.id)
    .order('position')
  if (itemsErr) return { ok: false, error: itemsErr.message }

  const { data: created, error: insertError } = await supabase
    .from('proposals')
    .insert({
      client_id: source.client_id,
      lead_id: source.lead_id,
      number: null,
      title: `Copia de ${source.title as string}`,
      status: 'draft',
      currency: (source.currency as string) ?? 'EUR',
      subtotal: source.subtotal,
      tax_amount: source.tax_amount,
      total: source.total,
      valid_until: null,
      notes: source.notes,
      context_markdown: source.context_markdown,
      problems: source.problems,
      solutions: source.solutions,
      terms: source.terms,
      scope_modules: source.scope_modules,
      deliverables: source.deliverables,
      acceptance_criteria: source.acceptance_criteria,
      payment_schedule: source.payment_schedule,
      payment_terms: source.payment_terms,
      change_management_terms: source.change_management_terms,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (insertError || !created) {
    log.error({ err: insertError, sourceId: parsed.data.id }, 'duplicate_proposal_failed')
    return { ok: false, error: insertError?.message ?? 'No se pudo duplicar la propuesta' }
  }

  if ((items ?? []).length > 0) {
    const { error: copyErr } = await supabase.from('proposal_items').insert(
      (items ?? []).map((it, idx) => ({
        proposal_id: created.id,
        position: idx,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        billing_cycle: it.billing_cycle,
      })),
    )
    if (copyErr) {
      log.error({ err: copyErr, sourceId: parsed.data.id }, 'duplicate_proposal_items_failed')
      return { ok: false, error: copyErr.message }
    }
  }

  revalidatePath('/proposals')
  return { ok: true, id: created.id as string }
}

// ---------------- UPDATE (collaborative inline edits + autosave) ----------------

type UpdateResult = { ok: true; version: number } | { ok: false; error: string; code?: 'conflict' }

/**
 * Patches a proposal in place. Used by the inline editor + autosave loop.
 * Accepts a partial payload; when `items` is present the line items are
 * replaced atomically (delete + insert) and totals recomputed server-side.
 *
 * Locked once the proposal is `accepted` or `rejected`.
 */
export async function updateProposal(input: unknown): Promise<UpdateResult> {
  await requireUser()

  const parsed = UpdateProposalInput.safeParse(input)
  if (!parsed.success) {
    const errors = formatProposalValidationIssues(parsed.error.issues)
    return { ok: false, error: errors.join('\n') || 'Datos de la propuesta no válidos' }
  }
  const { id, expected_version, items, ...rest } = parsed.data

  const maintenanceOffer = parseMaintenanceOffer(rest.maintenance_options)
  if (
    rest.maintenance_selected_plan_id &&
    !selectedMaintenancePlan(maintenanceOffer, rest.maintenance_selected_plan_id)
  ) {
    return { ok: false, error: 'Mantenimiento: el plan seleccionado no existe en esta propuesta' }
  }

  const supabase = await createServerClient()

  const { data: current, error: readError } = await supabase
    .from('proposals')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (readError || !current) return { ok: false, error: 'Propuesta no encontrada' }
  if (!isProposalEditable(current.status)) {
    return { ok: false, error: 'La propuesta ya ha sido respondida y no se puede editar' }
  }

  const patch: Record<string, unknown> = {}
  if (rest.title !== undefined) patch.title = rest.title
  if (rest.valid_until !== undefined) patch.valid_until = rest.valid_until
  if (rest.notes !== undefined) patch.notes = rest.notes
  if (rest.context_markdown !== undefined) patch.context_markdown = rest.context_markdown
  if (rest.problems !== undefined) {
    patch.problems = rest.problems && rest.problems.length > 0 ? rest.problems : null
  }
  if (rest.solutions !== undefined) {
    patch.solutions = rest.solutions && rest.solutions.length > 0 ? rest.solutions : null
  }
  if (rest.terms !== undefined) patch.terms = rest.terms
  if (rest.scope_modules !== undefined) {
    patch.scope_modules =
      rest.scope_modules && rest.scope_modules.length > 0 ? rest.scope_modules : null
  }
  if (rest.deliverables !== undefined) patch.deliverables = rest.deliverables
  if (rest.acceptance_criteria !== undefined) patch.acceptance_criteria = rest.acceptance_criteria
  if (rest.payment_schedule !== undefined) patch.payment_schedule = rest.payment_schedule
  if (rest.payment_plan !== undefined) patch.payment_plan = rest.payment_plan
  if (rest.payment_terms !== undefined) patch.payment_terms = rest.payment_terms
  if (rest.change_management_terms !== undefined) {
    patch.change_management_terms = rest.change_management_terms
  }
  if (rest.maintenance_options !== undefined) patch.maintenance_options = rest.maintenance_options
  if (rest.maintenance_selected_plan_id !== undefined) {
    patch.maintenance_selected_plan_id = rest.maintenance_selected_plan_id
    patch.maintenance_selection_source = rest.maintenance_selected_plan_id ? 'team' : null
    patch.maintenance_selected_at = rest.maintenance_selected_plan_id
      ? new Date().toISOString()
      : null
  }

  if (items) {
    const { data, error: rpcError } = await supabase.rpc('update_proposal_items_versioned', {
      p_proposal_id: id,
      p_expected_version: expected_version,
      p_patch: patch,
      p_items: items,
    })
    if (rpcError) {
      if (rpcError.message === 'VERSION_CONFLICT') {
        return {
          ok: false,
          code: 'conflict',
          error: 'Este registro ha cambiado mientras lo editabas.',
        }
      }
      log.error({ err: rpcError, id }, 'replace_proposal_items_failed')
      return { ok: false, error: rpcError.message }
    }
    const version = Number((data as Array<{ version: number }> | null)?.[0]?.version)
    if (!Number.isSafeInteger(version))
      return { ok: false, error: 'No se pudo confirmar el guardado' }
    revalidatePath(`/proposals/${id}`)
    return { ok: true, version }
  } else if (Object.keys(patch).length > 0) {
    const { data, error: updateError } = await supabase
      .from('proposals')
      .update(patch)
      .eq('id', id)
      .eq('version', expected_version)
      .select('version')
      .maybeSingle()
    if (updateError) {
      log.error({ err: updateError, id }, 'update_proposal_failed')
      return { ok: false, error: updateError.message }
    }
    if (!data)
      return {
        ok: false,
        code: 'conflict',
        error: 'Este registro ha cambiado mientras lo editabas.',
      }
    revalidatePath(`/proposals/${id}`)
    return { ok: true, version: Number(data.version) }
  }

  return { ok: true, version: expected_version }
}

/**
 * Updates only the payment calendar after acceptance. Amounts already attached
 * to a draft or issued invoice stay frozen in the plan to prevent divergence.
 */
export async function updateProposalPaymentPlan(input: unknown): Promise<UpdateResult> {
  const user = await requireUser()
  if (user.role === 'viewer')
    return { ok: false, error: 'No tienes permiso para editar el calendario' }
  const parsed = UpdateProposalPaymentPlanInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: formatProposalValidationIssues(parsed.error.issues).join('\n') }
  }

  const { id, expected_version, payment_plan } = parsed.data
  const supabase = await createServerClient()
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('status, payment_plan')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (proposalError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status === 'rejected') return { ok: false, error: 'La propuesta está rechazada' }

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('proposal_payment_plan_item_id')
    .eq('proposal_id', id)
    .is('deleted_at', null)
    .not('proposal_payment_plan_item_id', 'is', null)
  if (invoicesError) return { ok: false, error: invoicesError.message }

  const oldPlan = new Map(parsePaymentPlan(proposal.payment_plan).map((item) => [item.id, item]))
  const nextPlan = new Map(payment_plan.map((item) => [item.id, item]))
  for (const invoice of invoices ?? []) {
    const itemId = invoice.proposal_payment_plan_item_id as string | null
    if (!itemId) continue
    const previous = oldPlan.get(itemId)
    const next = nextPlan.get(itemId)
    if (!previous || !next || next.percentage !== previous.percentage) {
      return {
        ok: false,
        error:
          'No puedes cambiar el importe ni eliminar un plazo que ya tiene una factura preparada',
      }
    }
  }

  const { data, error: updateError } = await supabase
    .from('proposals')
    .update({ payment_plan })
    .eq('id', id)
    .eq('version', expected_version)
    .select('version')
    .maybeSingle()
  if (updateError) return { ok: false, error: updateError.message }
  if (!data) {
    return {
      ok: false,
      code: 'conflict',
      error: 'Este registro ha cambiado mientras lo editabas.',
    }
  }

  revalidatePath(`/proposals/${id}`)
  return { ok: true, version: Number(data.version) }
}

// ---------------- LINK PROJECT ----------------

/**
 * Sets or clears the `project_id` on a proposal. Passing `project_id: null`
 * unlinks the proposal from any project. Works on any proposal status so the
 * team can connect proposals created before the project existed.
 */
export async function linkProposalToProject(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()

  const parsed = z
    .object({ proposal_id: z.string().uuid(), project_id: z.string().uuid().nullable() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos no válidos' }

  const { proposal_id, project_id } = parsed.data
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('proposals')
    .update({ project_id })
    .eq('id', proposal_id)
    .is('deleted_at', null)

  if (error) {
    log.error({ err: error, proposal_id }, 'link_proposal_to_project_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath(`/proposals/${proposal_id}`)
  if (project_id) revalidatePath(`/projects/${project_id}`)
  return { ok: true }
}

// ---------------- PROPOSAL TEAM ----------------

/** Replaces the people shown as the project team in the client deck. */
export async function setProposalTeamMembers(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()

  const parsed = UpdateProposalTeamInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos no válidos' }

  const { proposal_id, member_ids } = parsed.data
  const supabase = await createServerClient()
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('status')
    .eq('id', proposal_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (proposalError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (!isProposalEditable(proposal.status)) {
    return { ok: false, error: 'La propuesta ya ha sido respondida y no se puede editar' }
  }

  if (member_ids.length > 0) {
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id')
      .in('id', member_ids)
      .is('deleted_at', null)
    if (membersError || members?.length !== member_ids.length) {
      return { ok: false, error: 'Hay personas seleccionadas que ya no están disponibles' }
    }
  }

  const { error: deleteError } = await supabase
    .from('proposal_team_members')
    .delete()
    .eq('proposal_id', proposal_id)
  if (deleteError) return { ok: false, error: deleteError.message }

  if (member_ids.length > 0) {
    const { error: insertError } = await supabase
      .from('proposal_team_members')
      .insert(member_ids.map((member_id, position) => ({ proposal_id, member_id, position })))
    if (insertError) return { ok: false, error: insertError.message }
  }

  revalidatePath(`/proposals/${proposal_id}`)
  return { ok: true }
}

// ---------------- DELETE (soft) ----------------

/**
 * Soft-deletes a proposal by stamping `deleted_at`. The associated invoice
 * FK (`invoices.proposal_id`) is `on delete set null` at the DB level, so
 * already-issued invoices keep their data even after deletion. Reversible
 * by clearing `deleted_at` directly in the database.
 */
export async function deleteProposal(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const id = formData.get('id')?.toString() ?? ''
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('proposals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'delete_proposal_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath('/proposals')
  return { ok: true }
}

/**
 * Reverses a soft-delete by clearing `deleted_at`. Backs the "Deshacer" toast
 * shown after `deleteProposal`. Mirrors `deleteProposal`'s FormData signature.
 */
export async function restoreProposal(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const id = formData.get('id')?.toString() ?? ''
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'ID inválido' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('proposals').update({ deleted_at: null }).eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'restore_proposal_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  return { ok: true }
}

// ---------------- PORTAL ACCESS (visibility + password) ----------------

/**
 * Updates the public-link access controls of a proposal: the
 * `is_client_visible` toggle and/or the optional password gate. Each field is
 * independent — omit one to leave it untouched. `password: null` clears it.
 */
export async function updateProposalPortalAccess(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser()
  const parsed = UpdatePortalAccessInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const patch = buildPortalAccessPatch(parsed.data)
  if (Object.keys(patch).length === 0) return { ok: true }

  const supabase = await createServerClient()
  const { error } = await supabase.from('proposals').update(patch).eq('id', parsed.data.id)
  if (error) {
    log.error({ err: error, id: parsed.data.id }, 'update_proposal_portal_access_failed')
    return { ok: false, error: error.message }
  }

  revalidatePath(`/proposals/${parsed.data.id}`)
  return { ok: true }
}

// ---------------- MARK AS SENT (without email) ----------------

/**
 * Transitions a draft proposal to `sent` and assigns it a legal number without sending any email — useful when the proposal was delivered in person, by phone, or through another channel.
 */
export async function markProposalAsSent(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser()

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, number, status, title, lead_id, client_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status !== 'draft') return { ok: true } // idempotent

  const number = (proposal.number as string | null) ?? (await nextProposalNumber(supabase))
  const { error } = await supabase
    .from('proposals')
    .update({ number, status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'mark_proposal_as_sent_failed')
    return { ok: false, error: error.message }
  }

  const leadId = await completeProposalDelivery(
    supabase,
    {
      id,
      title: proposal.title as string,
      lead_id: (proposal.lead_id as string | null) ?? null,
      client_id: (proposal.client_id as string | null) ?? null,
    },
    user.id,
  )

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  if (leadId) revalidatePath(`/leads/${leadId}`)
  revalidatePath('/leads')
  revalidatePath('/inicio')
  return { ok: true }
}

// ---------------- SEND PREVIEW LINK (client portal) ----------------

type SendPreviewResult =
  | { ok: true; portalUrl: string; mocked: boolean }
  | { ok: false; error: string }

type ProposalEmailPreviewResult =
  | { ok: true; subject: string; html: string }
  | { ok: false; error: string }

type ProposalEmailData = {
  id: string
  number: string | null
  title: string
  total: number
  valid_until: string | null
  portal_token: string | null
  clients: { name: string; email: string | null } | null
  leads: { name: string; email: string | null } | null
}

async function renderProposalPreview(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  proposal: ProposalEmailData,
  message: string | undefined,
): Promise<
  | { ok: true; proposalNumber: string; portalUrl: string; subject: string; html: string }
  | { ok: false; error: string }
> {
  const portalToken = proposal.portal_token
  if (!portalToken) return { ok: false, error: 'La propuesta no tiene token de portal' }

  const appUrl = externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)
  const proposalNumber = proposal.number ?? (await nextProposalNumber(supabase))
  const { data: specs } = await supabase
    .from('proposal_specs')
    .select('title, portal_token')
    .eq('proposal_id', proposal.id)
    .eq('is_client_visible', true)
    .not('portal_token', 'is', null)

  const specLinks = ((specs ?? []) as Array<{ title: string; portal_token: string }>)
    .filter((spec) => spec.portal_token)
    .map((spec) => ({
      title: spec.title,
      url: `${appUrl}/p/spec/${spec.portal_token}`,
    }))
  const portalUrl = `${appUrl}/p/proposal/${portalToken}`
  const html = await renderEmail(
    ProposalEmail({
      clientName: proposal.clients?.name ?? proposal.leads?.name ?? 'Hola',
      proposalTitle: proposal.title,
      proposalNumber,
      total: formatEUR(proposal.total),
      validUntil: proposal.valid_until ? formatDate(proposal.valid_until) : undefined,
      portalUrl,
      deckUrl: `${appUrl}/deck/${portalToken}`,
      appUrl,
      message,
      specs: specLinks,
    }),
  )

  return {
    ok: true,
    proposalNumber,
    portalUrl,
    subject: `Propuesta ${proposalNumber} · ${proposal.title}`,
    html,
  }
}

/** Renders the exact proposal email for review without delivering it. */
export async function previewProposalEmail(input: unknown): Promise<ProposalEmailPreviewResult> {
  await requireUser()

  const parsed = SendProposalPreviewInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }

  const supabase = await createServerClient()
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(
      'id, number, title, total, portal_token, valid_until, clients(name, email), leads(name, email)',
    )
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !proposal) return { ok: false, error: 'Propuesta no encontrada' }

  const rendered = await renderProposalPreview(
    supabase,
    proposal as unknown as ProposalEmailData,
    parsed.data.message,
  )
  if (!rendered.ok) return rendered
  return { ok: true, subject: rendered.subject, html: rendered.html }
}

/**
 * Sends the public portal URL of a proposal to the client via Resend and
 * transitions the proposal from `draft` → `sent` (setting `sent_at`).
 * Idempotent for already-sent proposals.
 */
export async function sendPreviewLink(input: unknown): Promise<SendPreviewResult> {
  const user = await requireUser()

  const parsed = SendProposalPreviewInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos no válidos' }
  }
  const { id, to: overrideTo, message } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select(
      'id, number, title, total, status, portal_token, valid_until, sent_at, lead_id, client_id, clients(name, email), leads(name, email)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }

  // Recipient: prefer the explicit override, otherwise fall back to the
  // client email and finally to the lead email when the proposal targets a
  // lead that hasn't yet been upgraded to a client.
  const proposalEmailData = proposal as unknown as ProposalEmailData
  const client = proposalEmailData.clients
  const lead = proposalEmailData.leads
  const recipient = overrideTo ?? client?.email ?? lead?.email ?? null
  if (!recipient) return { ok: false, error: 'El destinatario no tiene email registrado' }

  const rendered = await renderProposalPreview(supabase, proposalEmailData, message)
  if (!rendered.ok) return rendered
  const { proposalNumber, portalUrl, subject, html } = rendered

  let mocked = false
  try {
    const result = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? 'propuestas',
      to: recipient,
      replyTo: user.contactEmail ?? user.email,
      subject,
      html,
      tags: { proposal_id: id, kind: 'proposal_preview' },
    })
    mocked = result.mocked
  } catch (err) {
    log.error({ err, proposalId: id }, 'send_preview_link_failed')
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo enviar el email' }
  }

  const patch: Record<string, unknown> = {}
  if (!proposal.number) patch.number = proposalNumber
  if (proposal.status === 'draft') {
    patch.status = 'sent'
    patch.sent_at = new Date().toISOString()
  } else if (!proposal.sent_at) {
    patch.sent_at = new Date().toISOString()
  }
  let syncedLeadId: string | null = null
  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from('proposals').update(patch).eq('id', id)
    if (updateError) {
      log.error({ err: updateError, id }, 'send_preview_link_update_failed')
    } else if (proposal.status === 'draft') {
      syncedLeadId = await completeProposalDelivery(
        supabase,
        {
          id,
          title: proposal.title as string,
          lead_id: (proposal.lead_id as string | null) ?? null,
          client_id: (proposal.client_id as string | null) ?? null,
        },
        user.id,
      )
    }
  }

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  if (syncedLeadId) revalidatePath(`/leads/${syncedLeadId}`)
  if (syncedLeadId) revalidatePath('/leads')
  if (proposal.status === 'draft') revalidatePath('/inicio')
  return { ok: true, portalUrl, mocked }
}

// ---------------- MANUAL RESPONSE ----------------

/**
 * Records a rejection communicated outside the client portal. Only proposals
 * that have already been delivered can be rejected manually.
 */
export async function markProposalAsRejected(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole(['owner', 'admin'])

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, status, number')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status === 'rejected') return { ok: true }
  if (!['sent', 'viewed', 'expired'].includes(proposal.status as string)) {
    return { ok: false, error: 'Solo se pueden rechazar propuestas enviadas, vistas o expiradas' }
  }

  const { error } = await supabase
    .from('proposals')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'mark_proposal_as_rejected_failed')
    return { ok: false, error: error.message }
  }

  log.info({ id, number: proposal.number, by: user.email }, 'proposal_manually_rejected')
  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  return { ok: true }
}

/**
 * Allows team members to mark a proposal as accepted without the client
 * going through the portal — useful when acceptance happened in person or by phone.
 * Idempotent: already-accepted proposals return ok immediately.
 */
export async function markProposalAsAccepted(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole(['owner', 'admin'])

  const parsed = z
    .object({ id: z.string().uuid(), fiscal: AcceptProposalFiscalData.optional() })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, number, status, client_id, lead_id, clients(name, nif, billing_address_street)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status === 'rejected')
    return { ok: false, error: 'No se puede aceptar una propuesta rechazada' }

  const client = (
    proposal as unknown as {
      clients: {
        name: string | null
        nif: string | null
        billing_address_street: string | null
      } | null
    }
  ).clients
  const needsFiscal = proposal.lead_id != null || !client || !hasCompleteFiscalData(client)
  if (proposal.status === 'accepted' && !needsFiscal) return { ok: true }
  let fiscal: z.infer<typeof AcceptProposalFiscalData> | undefined
  if (needsFiscal) {
    const fiscalResult = AcceptProposalFiscalData.safeParse(parsed.data.fiscal)
    if (!fiscalResult.success) {
      return {
        ok: false,
        error: fiscalResult.error.errors[0]?.message ?? 'Datos fiscales no válidos',
      }
    }
    fiscal = fiscalResult.data

    const ensured = await ensureClientForProposal(supabase, id, fiscal)
    if ('error' in ensured) return { ok: false, error: ensured.error }
  }

  // Ensure it has a number (drafts that were never sent won't have one yet).
  const number =
    proposal.status === 'accepted'
      ? (proposal.number as string | null)
      : ((proposal.number as string | null) ?? (await nextProposalNumber(supabase)))

  const { error } = await supabase
    .from('proposals')
    .update({
      ...(number ? { number } : {}),
      ...(proposal.status === 'accepted'
        ? {}
        : { status: 'accepted', responded_at: new Date().toISOString() }),
      accepted_fiscal_data: fiscal ?? null,
    })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'mark_proposal_as_accepted_failed')
    return { ok: false, error: error.message }
  }

  // Best-effort Drive backup — fires as the acting user.
  void backupProposalToDrive(id, user.email)

  try {
    await ensureProjectForProposal(supabase, id)
    const { data: full } = await supabase
      .from('proposals')
      .select('client_id')
      .eq('id', id)
      .maybeSingle()
    if (full?.client_id) await promoteLeadFromClient(supabase, full.client_id as string)
  } catch (err) {
    log.warn({ err, proposalId: id }, 'manual_proposal_accept_side_effects_failed')
  }

  try {
    const result = await createProposalDraftInvoices(createAdminClient(), id, user.id)
    log.info({ proposalId: id, created: result.created }, 'proposal_invoice_drafts_created')
  } catch (err) {
    log.warn({ err, proposalId: id }, 'proposal_invoice_drafts_failed')
  }

  await sendProposalAcceptedEmail(id)

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  revalidatePath('/invoices')
  return { ok: true }
}

/**
 * Reopens an accepted or rejected proposal so the team can make adjustments
 * (e.g. a discount agreed in a follow-up meeting) and resend it for
 * re-acceptance. Only owners and admins can reopen.
 *
 * Clears the response fields (responded_at, signature_data, accepted_fiscal_data)
 * and reverts the status to `sent`, keeping the original number and portal token
 * intact so the client link remains valid.
 */
export async function reopenProposal(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole(['owner', 'admin'])

  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ID inválido' }
  const { id } = parsed.data

  const supabase = await createServerClient()
  const { data: proposal, error: readError } = await supabase
    .from('proposals')
    .select('id, status, number')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError || !proposal) return { ok: false, error: 'Propuesta no encontrada' }
  if (proposal.status !== 'accepted' && proposal.status !== 'rejected') {
    return { ok: false, error: 'Solo se pueden reabrir propuestas aceptadas o rechazadas' }
  }

  const { error } = await supabase
    .from('proposals')
    .update({
      status: 'sent',
      responded_at: null,
      signature_data: null,
      accepted_fiscal_data: null,
      acceptance_email_sent_at: null,
      acceptance_email_recipient: null,
      acceptance_email_resend_id: null,
    })
    .eq('id', id)

  if (error) {
    log.error({ err: error, id }, 'reopen_proposal_failed')
    return { ok: false, error: error.message }
  }

  log.info({ id, number: proposal.number, by: user.email }, 'proposal_reopened')

  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  return { ok: true }
}
