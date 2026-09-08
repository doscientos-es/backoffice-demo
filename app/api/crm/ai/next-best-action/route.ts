import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIObject } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { formatLeadBriefingForAI } from '@/lib/leads/ai-context'
import { getLeadDetail } from '@/lib/leads/queries'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('ai.next-best-action')
const BodySchema = z
  .object({ lead_id: z.string().uuid().optional(), proposal_id: z.string().uuid().optional() })
  .refine((value) => Boolean(value.lead_id || value.proposal_id), 'Falta el recurso a analizar')
const ResultSchema = z.object({
  headline: z.string().min(1).max(160),
  rationale: z.string().min(1).max(500),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']),
  channel: z.enum(['email', 'whatsapp', 'call', 'internal']),
  action: z.string().min(1).max(400),
  message: z.string().max(3000).default(''),
  task: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(800).default(''),
  }),
})

const SYSTEM_PROMPT = `Eres un asistente comercial. Propón UNA siguiente acción para reactivar una oportunidad.
Usa exclusivamente la evidencia de contexto. Explica brevemente por qué ahora, y prepara un borrador solo si
el canal es email o WhatsApp. No prometas alcance, precio, fechas, descuentos ni disponibilidad no registrados.
Una recomendación no autoriza enviar nada: debe poder revisarse y editarse.`

export async function POST(req: NextRequest) {
  if (!isAIEnabled()) return NextResponse.json({ error: 'ai_disabled' }, { status: 503 })
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role === 'viewer') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!rateLimit(`ai:next-action:${user.id}`, 10).success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'recurso inválido' }, { status: 400 })
  }

  let context: string
  if (body.lead_id) {
    const detail = await getLeadDetail(body.lead_id)
    if (!detail) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
    context = formatLeadBriefingForAI({
      lead: detail.lead,
      clientName: detail.linkedClientName,
      interactions: detail.interactions,
      proposals: detail.proposals,
      projects: detail.projects,
      invoices: detail.invoices,
      tasks: detail.tasks,
      reminders: detail.reminders,
      attachments: detail.attachments,
    })
  } else {
    const supabase = await createServerClient()
    const { data: proposal } = await supabase
      .from('proposals')
      .select(
        'title, status, sent_at, viewed_at, valid_until, notes, clients(name), leads(name, company, email)',
      )
      .eq('id', body.proposal_id as string)
      .is('deleted_at', null)
      .maybeSingle()
    if (!proposal) return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 })
    context = `Propuesta: ${proposal.title}\nEstado: ${proposal.status}\nEnviada: ${proposal.sent_at ?? '—'}\nVista: ${proposal.viewed_at ?? '—'}\nVálida hasta: ${proposal.valid_until ?? '—'}\nNotas: ${proposal.notes ?? '—'}\nDestinatario: ${JSON.stringify(proposal.clients ?? proposal.leads ?? '—')}`
  }

  try {
    const result = await runAIObject({
      model: AI_MODELS.drafter,
      system: SYSTEM_PROMPT,
      user: context,
      schema: ResultSchema,
      maxOutputTokens: 1100,
    })
    log.info({ leadId: body.lead_id, proposalId: body.proposal_id }, 'next_best_action_ok')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : err }, 'next_best_action_failed')
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 502 })
  }
}
