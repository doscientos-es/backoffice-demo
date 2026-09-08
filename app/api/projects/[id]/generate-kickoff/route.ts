import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIObject } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('ai.generate-kickoff')
const TaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(800).default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})
const ResultSchema = z.object({
  overview: z.string().min(1).max(600),
  phases: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        objective: z.string().min(1).max(300),
        tasks: z.array(TaskSchema).min(1).max(6),
      }),
    )
    .min(1)
    .max(4),
  checklist: z.array(z.string().min(1).max(300)).min(1).max(10),
  kickoff_agenda: z.array(z.string().min(1).max(300)).min(3).max(8),
})
const SYSTEM_PROMPT = `Eres un delivery lead de una agencia digital española. A partir de una propuesta aceptada,
prepara un plan de arranque interno revisable. No inventes entregables, integraciones, fechas, presupuesto,
responsables ni criterios que no estén expresamente en la propuesta. Agrupa las tareas por fases operativas,
mantén las tareas pequeñas y accionables y separa el checklist de onboarding de la agenda de kickoff.`

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAIEnabled()) return NextResponse.json({ error: 'ai_disabled' }, { status: 503 })
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role === 'viewer') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!rateLimit(`ai:kickoff:${user.id}`, 6).success)
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const { id } = await params
  const supabase = await createServerClient()
  const [{ data: project }, { data: proposal }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, description, notes, clients(name)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('proposals')
      .select(
        'title, context_markdown, notes, terms, problems, solutions, proposal_items(description, quantity, unit_price, billing_cycle)',
      )
      .eq('project_id', id)
      .eq('status', 'accepted')
      .is('deleted_at', null)
      .order('responded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 })
  if (!proposal) return NextResponse.json({ error: 'accepted_proposal_required' }, { status: 422 })

  const context = `Proyecto: ${project.name}\nDescripción existente: ${project.description ?? '—'}\nNotas internas existentes: ${project.notes ?? '—'}\nPropuesta aceptada: ${proposal.title}\nContexto: ${proposal.context_markdown ?? '—'}\nNotas de alcance: ${proposal.notes ?? '—'}\nCondiciones: ${proposal.terms ?? '—'}\nProblemas: ${JSON.stringify(proposal.problems ?? [])}\nSoluciones: ${JSON.stringify(proposal.solutions ?? [])}\nPartidas: ${JSON.stringify(proposal.proposal_items ?? [])}`
  try {
    const plan = await runAIObject({
      model: AI_MODELS.drafter,
      system: SYSTEM_PROMPT,
      user: context,
      schema: ResultSchema,
      temperature: 0.25,
      maxOutputTokens: 2200,
    })
    log.info({ projectId: id, phases: plan.phases.length }, 'kickoff_plan_ok')
    return NextResponse.json({ ok: true, ...plan })
  } catch (err) {
    log.error(
      { projectId: id, err: err instanceof Error ? err.message : err },
      'kickoff_plan_failed',
    )
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 502 })
  }
}
