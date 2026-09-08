/**
 * POST /api/crm/ai/extract-tasks
 *
 * Analiza las notas e interacciones de un lead y extrae una lista de tareas accionables.
 * No persiste nada — devuelve sugerencias para que el usuario las revise y cree.
 *
 * Body: { lead_id: string }
 */

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

const log = scopedLogger('ai.extract-tasks')

const BodySchema = z.object({ lead_id: z.string().uuid() })

const TaskSuggestion = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})

const ResultSchema = z.object({
  tasks: z.array(TaskSuggestion).max(8).default([]),
})

const SYSTEM_PROMPT = `Eres un asistente de CRM para una agencia de desarrollo web española.
Analiza el briefing completo de un lead y extrae hasta 8 tareas accionables concretas que el equipo
comercial debería realizar para avanzar con este lead. Devuelve una lista vacía si el contexto no justifica
ninguna acción concreta.

Para cada tarea devuelve:
- "title": título corto y accionable (máx 200 chars). Empieza con un verbo (Llamar, Enviar, Preparar…).
- "description": contexto breve de por qué es necesaria (máx 500 chars, puede ser vacío).
- "priority": "low" | "medium" | "high" | "urgent" según la urgencia percibida.

Devuelve SOLO tareas que tengan sentido y valor real. Usa las transcripciones y los acuerdos explícitos
cuando existan; no inventes fechas, responsables, precios, alcance o compromisos.`

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
  if (!rl.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 })
  }

  const detail = await getLeadDetail(body.lead_id)
  if (!detail) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  const userPrompt = formatLeadBriefingForAI({
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

  try {
    const result = await runAIObject({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: ResultSchema,
      maxOutputTokens: 800,
    })

    log.info({ leadId: body.lead_id, count: result.tasks.length }, 'ai_extract_tasks_ok')
    return NextResponse.json({ ok: true, tasks: result.tasks })
  } catch (err) {
    log.error(
      { leadId: body.lead_id, err: err instanceof Error ? err.message : err },
      'ai_extract_tasks_failed',
    )
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
  }
}
