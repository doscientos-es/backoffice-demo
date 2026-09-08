import { normalizeAutomationText } from '@/lib/social/automation/matcher'
import type {
  AutomationAuditEvent,
  AutomationEventOutcome,
  AutomationRule,
  CreateAutomationRuleInput,
  MetaPlatform,
} from '@/lib/social/automation/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

interface AutomationRuleRow {
  id: string
  post_id: string | null
  platform: string
  keyword: string
  keyword_normalized: string
  public_reply: string
  private_message: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface AutomationRun {
  id: string
  privateStatus: 'pending' | 'sending' | 'sent' | 'failed'
  publicStatus: 'pending' | 'sending' | 'sent' | 'failed'
}

interface AutomationEventRow {
  id: string
  platform: string
  remote_post_id: string
  remote_comment_id: string
  target_id: string | null
  post_id: string | null
  rule_id: string | null
  run_id: string | null
  author_id: string | null
  author_name: string
  comment_text: string
  outcome: AutomationEventOutcome
  error: string | null
  created_at: string
  updated_at: string
}

interface AutomationRunStatusRow {
  id: string
  private_status: AutomationRun['privateStatus']
  public_status: AutomationRun['publicStatus']
}

export interface AutomationAuditItem extends AutomationAuditEvent {
  postCaption: string | null
}

export interface SocialTargetRef {
  id: string
  postId: string
}

const RULE_SELECT =
  'id, post_id, platform, keyword, keyword_normalized, public_reply, private_message, active, created_at, updated_at'
const EVENT_SELECT =
  'id, platform, remote_post_id, remote_comment_id, target_id, post_id, rule_id, run_id, author_id, author_name, comment_text, outcome, error, created_at, updated_at'

function mapRule(row: AutomationRuleRow): AutomationRule {
  return {
    id: row.id,
    postId: row.post_id,
    platform: row.platform as MetaPlatform,
    keyword: row.keyword,
    keywordNormalized: row.keyword_normalized,
    publicReply: row.public_reply,
    privateMessage: row.private_message,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Create one row per selected Meta platform. */
export async function createAutomationRules(input: CreateAutomationRuleInput): Promise<void> {
  const keyword = input.keyword.trim()
  const publicReply = input.publicReply.trim()
  const privateMessage = input.privateMessage.trim()
  const rows = input.platforms.map((platform) => ({
    post_id: input.postId,
    platform,
    keyword,
    keyword_normalized: normalizeAutomationText(keyword),
    public_reply: publicReply,
    private_message: privateMessage,
    created_by: input.createdBy,
  }))
  if (rows.length === 0) return

  const supabase = await createServerClient()
  const { error } = await supabase.from('social_automation_rules').insert(rows)
  if (error) throw new Error(`No se pudo guardar la automatización: ${error.message}`)
}

export async function listAutomationRules(): Promise<AutomationRule[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('social_automation_rules')
    .select(RULE_SELECT)
    .order('post_id', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(`No se pudieron cargar las automatizaciones: ${error.message}`)
  return (data as unknown as AutomationRuleRow[]).map(mapRule)
}

/** Rules are read with the service-role client because this runs from Meta webhooks. */
export async function listApplicableAutomationRules(
  postId: string,
  platform: MetaPlatform,
): Promise<AutomationRule[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('social_automation_rules')
    .select(RULE_SELECT)
    .eq('platform', platform)
    .eq('active', true)
    .or(`post_id.eq.${postId},post_id.is.null`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`No se pudieron cargar las reglas: ${error.message}`)
  return (data as unknown as AutomationRuleRow[])
    .map(mapRule)
    .sort((a, b) => Number(b.postId === postId) - Number(a.postId === postId))
}

export async function getAutomationRulesForPost(postId: string): Promise<AutomationRule[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('social_automation_rules')
    .select(RULE_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`No se pudieron cargar las automatizaciones: ${error.message}`)
  return (data as unknown as AutomationRuleRow[]).map(mapRule)
}

export async function setAutomationRuleActive(ruleId: string, active: boolean): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('social_automation_rules')
    .update({ active })
    .eq('id', ruleId)
  if (error) throw new Error(`No se pudo actualizar la automatización: ${error.message}`)
}

export async function deleteAutomationRule(ruleId: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase.from('social_automation_rules').delete().eq('id', ruleId)
  if (error) throw new Error(`No se pudo eliminar la automatización: ${error.message}`)
}

export async function findTargetByRemoteId(
  platform: MetaPlatform,
  remotePostId: string,
): Promise<SocialTargetRef | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('social_post_targets')
    .select('id, post_id')
    .eq('platform', platform)
    .eq('remote_id', remotePostId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo localizar el post remoto: ${error.message}`)
  return data ? { id: data.id as string, postId: data.post_id as string } : null
}

export async function getOrCreateAutomationEvent(input: {
  platform: MetaPlatform
  sourceId: string
  remotePostId: string
  remoteCommentId: string
  authorId: string | null
  authorName: string
  commentText: string
}): Promise<{ id: string; duplicate: boolean; outcome: AutomationEventOutcome }> {
  const supabase = createAdminClient()
  const { data: inserted } = await supabase
    .from('social_automation_events')
    .insert({
      platform: input.platform,
      source_id: input.sourceId,
      remote_post_id: input.remotePostId,
      remote_comment_id: input.remoteCommentId,
      author_id: input.authorId,
      author_name: input.authorName,
      comment_text: input.commentText,
    })
    .select('id, outcome')
    .maybeSingle()

  if (inserted) {
    return {
      id: inserted.id as string,
      duplicate: false,
      outcome: inserted.outcome as AutomationEventOutcome,
    }
  }

  const { data: existing, error } = await supabase
    .from('social_automation_events')
    .select('id, outcome')
    .eq('platform', input.platform)
    .eq('remote_comment_id', input.remoteCommentId)
    .single()
  if (error || !existing) throw new Error(`No se pudo registrar el evento: ${error?.message}`)
  return {
    id: existing.id as string,
    duplicate: true,
    outcome: existing.outcome as AutomationEventOutcome,
  }
}

export async function updateAutomationEvent(
  eventId: string,
  patch: {
    targetId?: string | null
    postId?: string | null
    ruleId?: string | null
    runId?: string | null
    outcome?: AutomationEventOutcome
    error?: string | null
  },
): Promise<void> {
  const supabase = createAdminClient()
  const update = {
    ...(patch.targetId !== undefined ? { target_id: patch.targetId } : {}),
    ...(patch.postId !== undefined ? { post_id: patch.postId } : {}),
    ...(patch.ruleId !== undefined ? { rule_id: patch.ruleId } : {}),
    ...(patch.runId !== undefined ? { run_id: patch.runId } : {}),
    ...(patch.outcome ? { outcome: patch.outcome } : {}),
    ...(patch.error !== undefined ? { error: patch.error } : {}),
  }
  const { error } = await supabase.from('social_automation_events').update(update).eq('id', eventId)
  if (error) throw new Error(`No se pudo actualizar el evento: ${error.message}`)
}

export async function listAutomationAudit(
  input: { limit?: number; outcome?: AutomationEventOutcome; platform?: MetaPlatform } = {},
): Promise<AutomationAuditItem[]> {
  const supabase = await createServerClient()
  let query = supabase
    .from('social_automation_events')
    .select(EVENT_SELECT)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 100)
  if (input.outcome) query = query.eq('outcome', input.outcome)
  if (input.platform) query = query.eq('platform', input.platform)
  const { data, error } = await query
  if (error) throw new Error(`No se pudo cargar la actividad: ${error.message}`)

  const rows = data as unknown as AutomationEventRow[]
  const runIds = rows.flatMap((row) => (row.run_id ? [row.run_id] : []))
  const postIds = rows.flatMap((row) => (row.post_id ? [row.post_id] : []))
  const [runsResult, postsResult] = await Promise.all([
    runIds.length
      ? supabase
          .from('social_automation_runs')
          .select('id, private_status, public_status')
          .in('id', runIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase.from('social_posts').select('id, caption').in('id', postIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (runsResult.error || postsResult.error) {
    throw new Error('No se pudo cargar el detalle de la actividad')
  }

  const runById = new Map(
    (runsResult.data as unknown as AutomationRunStatusRow[]).map((run) => [run.id, run]),
  )
  const captionById = new Map(
    (postsResult.data as Array<{ id: string; caption: string | null }>).map((post) => [
      post.id,
      post.caption,
    ]),
  )
  return rows.map((row) => {
    const run = row.run_id ? runById.get(row.run_id) : undefined
    return {
      id: row.id,
      platform: row.platform as MetaPlatform,
      remotePostId: row.remote_post_id,
      remoteCommentId: row.remote_comment_id,
      targetId: row.target_id,
      postId: row.post_id,
      ruleId: row.rule_id,
      runId: row.run_id,
      authorId: row.author_id,
      authorName: row.author_name,
      commentText: row.comment_text,
      outcome: row.outcome,
      error: row.error,
      privateStatus: run?.private_status ?? null,
      publicStatus: run?.public_status ?? null,
      postCaption: captionById.get(row.post_id ?? '') ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  })
}

export async function getOrCreateAutomationRun(input: {
  ruleId: string
  targetId: string
  platform: MetaPlatform
  remoteCommentId: string
}): Promise<AutomationRun> {
  const supabase = createAdminClient()
  const { data: inserted } = await supabase
    .from('social_automation_runs')
    .insert({
      rule_id: input.ruleId,
      target_id: input.targetId,
      platform: input.platform,
      remote_comment_id: input.remoteCommentId,
    })
    .select('id, private_status, public_status')
    .maybeSingle()

  if (inserted) {
    return {
      id: inserted.id as string,
      privateStatus: inserted.private_status as AutomationRun['privateStatus'],
      publicStatus: inserted.public_status as AutomationRun['publicStatus'],
    }
  }

  const { data: existing, error } = await supabase
    .from('social_automation_runs')
    .select('id, private_status, public_status')
    .eq('rule_id', input.ruleId)
    .eq('platform', input.platform)
    .eq('remote_comment_id', input.remoteCommentId)
    .single()
  if (error || !existing)
    throw new Error(`No se pudo reservar la automatización: ${error?.message}`)
  return {
    id: existing.id as string,
    privateStatus: existing.private_status as AutomationRun['privateStatus'],
    publicStatus: existing.public_status as AutomationRun['publicStatus'],
  }
}

export async function updateAutomationRun(
  runId: string,
  patch: {
    privateStatus?: AutomationRun['privateStatus']
    publicStatus?: AutomationRun['publicStatus']
    error?: string | null
  },
): Promise<void> {
  const supabase = createAdminClient()
  const update = {
    ...(patch.privateStatus ? { private_status: patch.privateStatus } : {}),
    ...(patch.publicStatus ? { public_status: patch.publicStatus } : {}),
    ...(patch.error !== undefined ? { error: patch.error } : {}),
  }
  const { error } = await supabase.from('social_automation_runs').update(update).eq('id', runId)
  if (error) throw new Error(`No se pudo actualizar la ejecución: ${error.message}`)
}

/** Claim one outbound step so concurrent webhook deliveries cannot duplicate it. */
export async function claimAutomationStep(
  runId: string,
  step: 'private' | 'public',
): Promise<boolean> {
  const supabase = createAdminClient()
  const column = step === 'private' ? 'private_status' : 'public_status'
  const { data, error } = await supabase
    .from('social_automation_runs')
    .update({ [column]: 'sending', error: null })
    .eq('id', runId)
    .in(column, ['pending', 'failed'])
    .select('id')
    .maybeSingle()
  if (error) throw new Error(`No se pudo reservar el envío: ${error.message}`)
  return Boolean(data)
}

export async function markCommentRepliedByRemote(
  targetId: string,
  remoteCommentId: string,
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('social_comments')
    .update({ replied: true })
    .eq('target_id', targetId)
    .eq('remote_comment_id', remoteCommentId)
  if (error) throw new Error(`No se pudo marcar el comentario como respondido: ${error.message}`)
}
