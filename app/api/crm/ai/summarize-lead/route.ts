/**
 * POST /api/crm/ai/summarize-lead
 *
 * Genera un resumen + siguiente paso + temperatura + confianza para un lead.
 * Persiste el resultado en leads.ai_* (sec. 22.1 description.md).
 *
 * Body: { lead_id: string }
 * Auth: requireUser (viewer denegado — la operación escribe en el lead).
 *
 * Devuelve 503 si la IA no está configurada — el feature-gate vive en
 * isAIEnabled() para que el frontend pueda detectarlo y mostrar <AiNotice/>.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIObject } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { listLeadConversionEvents } from '@/lib/conversion-events/queries'
import {
  formatLeadContextForAI,
  formatLeadConversionEventsForAI,
  formatLeadProposalsForAI,
  formatScheduledLeadTasksForAI,
} from '@/lib/leads/ai-context'
import { formatInteractionForAI } from '@/lib/leads/interaction-utils'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('ai.summarize-lead')

function timestamp(value: unknown): number {
  const parsed = new Date(String(value ?? '')).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

const BodySchema = z.object({
  lead_id: z.string().uuid(),
  force: z.boolean().optional().default(false),
})

const TEMPERATURES = ['hot', 'warm', 'cold'] as const
const ResultSchema = z.object({
  summary: z.string().min(1).max(2000),
  suggested_next_step: z.string().min(1).max(500),
  suggested_next_step_at: z.string().datetime({ offset: true }).nullable().default(null),
  temperature: z.enum(TEMPERATURES),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string().max(40)).max(5).default([]),
})
type AIResult = z.infer<typeof ResultSchema>

const SYSTEM_PROMPT = `Eres un asistente de CRM para una agencia de desarrollo web española.
Analiza TODO el contexto disponible del lead, su historial, propuestas y recordatorios. Devuelve:
- "summary": resumen en 2-3 frases en español.
- "suggested_next_step": una única acción concreta, breve y fácil de agendar (1 frase). Prioriza resolver el siguiente bloqueo real del lead y no repitas un contacto ya realizado sin motivo.
- "suggested_next_step_at": fecha y hora ISO 8601 con zona horaria para agendar la acción cuando exista una fecha/hora explícita o se pueda calcular con seguridad a partir del contexto; si no, null. Usa la fecha/hora actual proporcionada en los datos para interpretar "mañana", "esta semana", etc. No inventes una hora.
- "temperature": "hot" | "warm" | "cold".
- "confidence": número entre 0.0 y 1.0.
- "tags": array de 1-5 etiquetas cortas (máx 40 chars cada una) que categoricen al lead.
  Ejemplos: "E-commerce", "Presupuesto alto", "Urgente", "Startup", "Legacy refactor",
  "Interés en IA", "Sin contactar", "Empresa grande", "SaaS", "App móvil".
  Usa solo etiquetas que puedas inferir con seguridad de los datos.`

export async function POST(req: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'ai_disabled' }, { status: 503 })
  }

  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const rl = rateLimit(`ai:${user.id}`, 10)
  if (!rl.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'lead_id is required and must be a UUID' }, { status: 400 })
  }

  const supabase = await createServerClient()

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select(
      'id, name, alias, company, email, phone, source, status, notes, estimated_value, score, company_size, solution_type, urgency, first_contacted_at, landing_path, landing_ref, landing_subject, conversion_step, event_id, first_landing_path, first_referrer, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_term, first_utm_content, last_landing_path, last_referrer, last_utm_source, last_utm_medium, last_utm_campaign, last_utm_term, last_utm_content, calculator_cost, calculator_hours, created_at, updated_at, ai_summary, ai_suggested_next_step, ai_suggested_next_step_at, ai_temperature, ai_confidence, ai_updated_at, ai_tags, lost_reason, lost_at, mom_test_real_problem, mom_test_aware_problem, mom_test_tried_solutions, mom_test_decision_power_or_budget, mom_test_accessible',
    )
    .eq('id', body.lead_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'lead not found' }, { status: 404 })
  }

  const [{ data: interactions }, { data: scheduledTasks }, { data: linkedClient }] =
    await Promise.all([
      supabase
        .from('lead_interactions')
        .select('type, subject, body, payload, created_at')
        .eq('lead_id', body.lead_id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('tasks')
        .select('title, description, start_at, status, priority, updated_at')
        .eq('kind', 'reminder')
        .eq('lead_id', body.lead_id)
        .is('completed_at', null)
        .is('deleted_at', null)
        .order('start_at', { ascending: true })
        .limit(20),
      supabase
        .from('clients')
        .select('id, name')
        .eq('lead_id', body.lead_id)
        .is('deleted_at', null)
        .maybeSingle(),
    ])

  const proposalFilter = linkedClient?.id
    ? `lead_id.eq.${body.lead_id},client_id.eq.${linkedClient.id}`
    : `lead_id.eq.${body.lead_id}`
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'number, title, status, total, valid_until, sent_at, viewed_at, responded_at, notes, updated_at',
    )
    .or(proposalFilter)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(10)
  const conversionEvents = await listLeadConversionEvents({
    id: body.lead_id,
    event_id: (lead.event_id as string | null) ?? null,
  }).catch(() => [])

  // --- CACHE CHECK ---
  if (!body.force && lead.ai_updated_at) {
    const aiTs = timestamp(lead.ai_updated_at)
    const leadTs = timestamp(lead.updated_at)
    const lastInteraction = interactions?.[0]
    const interactionTs = lastInteraction ? timestamp(lastInteraction.created_at) : 0
    const contextTs = Math.max(
      leadTs,
      interactionTs,
      ...(scheduledTasks ?? []).map((task) => timestamp(task.updated_at)),
      ...(proposals ?? []).map((proposal) => timestamp(proposal.updated_at)),
      ...(conversionEvents ?? []).map((event) => timestamp(event.created_at)),
    )

    // Recalcula si cambió el lead, el historial, un recordatorio o una propuesta.
    if (aiTs >= contextTs - 1000) {
      log.info({ leadId: body.lead_id }, 'ai_summarize_cache_hit')
      return NextResponse.json({
        ok: true,
        cached: true,
        summary: lead.ai_summary,
        suggested_next_step: lead.ai_suggested_next_step,
        suggested_next_step_at: lead.ai_suggested_next_step_at,
        temperature: lead.ai_temperature,
        confidence: lead.ai_confidence,
        tags: lead.ai_tags ?? [],
        ai_updated_at: lead.ai_updated_at,
      })
    }
  }

  const interactionsText = (interactions ?? [])
    .reverse()
    .map((i) =>
      formatInteractionForAI({
        type: i.type as string,
        subject: (i.subject as string | null) ?? null,
        body: (i.body as string | null) ?? null,
        payload: i.payload,
        created_at: i.created_at as string,
      }),
    )
    .join('\n')

  const leadContext = formatLeadContextForAI(lead as Record<string, unknown>)
  const tasksText = formatScheduledLeadTasksForAI(
    (scheduledTasks ?? []).map((task) => ({
      title: (task.title as string | null) ?? null,
      description: (task.description as string | null) ?? null,
      start_at: (task.start_at as string | null) ?? null,
      status: (task.status as string | null) ?? null,
      priority: (task.priority as string | number | null) ?? null,
    })),
  )
  const proposalsText = formatLeadProposalsForAI(
    (proposals ?? []).map((proposal) => ({
      number: (proposal.number as string | null) ?? null,
      title: (proposal.title as string | null) ?? null,
      status: (proposal.status as string | null) ?? null,
      total: proposal.total == null ? null : Number(proposal.total),
      valid_until: (proposal.valid_until as string | null) ?? null,
      sent_at: (proposal.sent_at as string | null) ?? null,
      viewed_at: (proposal.viewed_at as string | null) ?? null,
      responded_at: (proposal.responded_at as string | null) ?? null,
      notes: (proposal.notes as string | null) ?? null,
    })),
  )
  const conversionEventsText = formatLeadConversionEventsForAI(
    conversionEvents.map((event) => ({
      event_name: event.event_name,
      conversion_step: event.conversion_step,
      landing_path: event.landing_path,
      referrer: event.referrer,
      utm_source: event.utm_source,
      utm_campaign: event.utm_campaign,
      created_at: event.created_at,
    })),
  )

  const userPrompt = `Fecha/hora actual UTC: ${new Date().toISOString()}

${leadContext}
Cliente vinculado: ${linkedClient?.name ?? '—'}

Historial completo disponible (cronológico; las llamadas incluyen notas, resultado, duración y transcripción):
${interactionsText || '(sin interacciones registradas)'}

Recordatorios pendientes:
${tasksText || '(sin recordatorios pendientes)'}

Propuestas relacionadas:
${proposalsText || '(sin propuestas relacionadas)'}

Journey de conversión:
${conversionEventsText || '(sin eventos de conversión)'}`

  let result: AIResult
  try {
    result = await runAIObject({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: ResultSchema,
      maxOutputTokens: 600,
    })
  } catch (err) {
    log.error(
      { leadId: body.lead_id, err: err instanceof Error ? err.message : err },
      'ai_summarize_failed',
    )
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('leads')
    .update({
      ai_summary: result.summary,
      ai_suggested_next_step: result.suggested_next_step,
      ai_suggested_next_step_at: result.suggested_next_step_at,
      ai_temperature: result.temperature,
      ai_confidence: result.confidence,
      ai_tags: result.tags.length > 0 ? result.tags : null,
      ai_updated_at: now,
    })
    .eq('id', body.lead_id)

  if (updateErr) {
    log.error({ leadId: body.lead_id, err: updateErr.message }, 'ai_summarize_persist_failed')
    // Devolvemos el resultado aunque la persistencia haya fallado — el cliente
    // puede mostrarlo y reintentar el guardado.
    return NextResponse.json({ ok: true, persisted: false, ...result, ai_updated_at: now })
  }

  log.info({ leadId: body.lead_id, temperature: result.temperature }, 'ai_summarize_ok')
  return NextResponse.json({ ok: true, persisted: true, ...result, ai_updated_at: now })
}
