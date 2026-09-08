import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIObject } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { formatLeadBriefingForAI } from '@/lib/leads/ai-context'
import { getLeadDetail } from '@/lib/leads/queries'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('ai.call-copilot')
const BodySchema = z.object({ lead_id: z.string().uuid() })
const TaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(800).default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})
const ResultSchema = z.object({
  summary: z.string().min(1).max(1800),
  decisions: z.array(z.string().max(300)).max(6).default([]),
  open_questions: z.array(z.string().max(300)).max(5).default([]),
  tasks: z.array(TaskSchema).max(6).default([]),
  follow_up_focus: z.string().max(500).default(''),
})

const SYSTEM_PROMPT = `Eres copiloto comercial para una agencia digital española. Resume la llamada más reciente
usando SOLO el briefing entregado. Distingue lo acordado de lo que sigue abierto. Propón tareas únicamente
cuando una acción se haya solicitado explícitamente o sea una consecuencia comercial inequívoca. No inventes
fechas, presupuesto, alcance, compromisos ni responsables. El texto se revisa internamente: no redactes un email.`

export async function POST(req: NextRequest) {
  if (!isAIEnabled()) return NextResponse.json({ error: 'ai_disabled' }, { status: 503 })
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role === 'viewer') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!rateLimit(`ai:call-copilot:${user.id}`, 10).success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'lead_id inválido' }, { status: 400 })
  }

  const detail = await getLeadDetail(body.lead_id)
  if (!detail) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  const hasCall = detail.interactions.some((item) => item.type === 'call')
  if (!hasCall) return NextResponse.json({ error: 'call_not_found' }, { status: 422 })

  try {
    const result = await runAIObject({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: formatLeadBriefingForAI({
        lead: detail.lead,
        clientName: detail.linkedClientName,
        interactions: detail.interactions,
        proposals: detail.proposals,
        projects: detail.projects,
        invoices: detail.invoices,
        tasks: detail.tasks,
        reminders: detail.reminders,
        attachments: detail.attachments,
      }),
      schema: ResultSchema,
      maxOutputTokens: 1400,
    })
    log.info({ leadId: body.lead_id, tasks: result.tasks.length }, 'call_copilot_ok')
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    log.error(
      { leadId: body.lead_id, err: err instanceof Error ? err.message : err },
      'call_copilot_failed',
    )
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 502 })
  }
}
