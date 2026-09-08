/**
 * POST /api/proposals/[id]/generate-narrative
 *
 * Propone 3 pares problema→solución para una propuesta, a partir del contexto
 * del proyecto, cliente y líneas. NO persiste nada: devuelve el JSON para que
 * el editor lo cargue y el equipo lo revise antes de guardar (autosave).
 *
 * Auth: requireUser (viewer denegado).
 * 503 si no hay clave de IA (isAIEnabled() falsy).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIObject } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('ai.generate-narrative')

const PairSchema = z.object({
  problem: z.string().min(1).max(200),
  problemDescription: z.string().min(1).max(2000),
  solution: z.string().min(1).max(200),
  solutionDescription: z.string().min(1).max(2000),
})
const ResultSchema = z.object({ pairs: z.array(PairSchema).min(1).max(5) })

const SYSTEM_PROMPT = `Eres un consultor senior en una agencia española que
construye productos digitales a medida. A partir del contexto de una propuesta,
identifica los retos reales del cliente y cómo los resolvemos.

Devuelve SOLO un JSON con esta forma exacta:
{
  "pairs": [
    { "problem": "…", "problemDescription": "…", "solution": "…", "solutionDescription": "…" }
  ]
}

Reglas estrictas:
- Exactamente 3 pares.
- "problem"/"solution": titulares concisos (máx ~10 palabras), sin punto final.
- "problemDescription"/"solutionDescription": 1-2 frases concretas.
- Cada solución resuelve directamente su problema emparejado.
- Español neutro, tono profesional. No inventes precios, plazos ni nombres.
- No incluyas texto fuera del JSON.`

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params
  const supabase = await createServerClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select(
      'id, number, title, notes, context_markdown, clients(name), projects(name, description)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!proposal) {
    return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 })
  }

  const { data: items } = await supabase
    .from('proposal_items')
    .select('description, quantity')
    .eq('proposal_id', id)
    .order('position')

  const client = (proposal as unknown as { clients: { name: string } | null }).clients
  const project = (
    proposal as unknown as { projects: { name: string; description: string | null } | null }
  ).projects

  const itemsText = (items ?? [])
    .map((it) => {
      const desc = (it.description as string | null)?.trim() ?? ''
      const qty = Number(it.quantity) || 0
      return `- ${desc} (x${qty})`
    })
    .join('\n')

  const userPrompt = `Propuesta: ${proposal.number as string} — ${proposal.title as string}
Cliente: ${client?.name ?? '—'}
Proyecto: ${project?.name ?? '—'}
Descripción proyecto: ${project?.description ?? '—'}
Contexto: ${(proposal.context_markdown as string | null) ?? '—'}
Notas de la propuesta: ${(proposal.notes as string | null) ?? '—'}

Líneas de la propuesta:
${itemsText || '(sin líneas)'}

Genera 3 pares problema→solución siguiendo el formato indicado.`

  let result: z.infer<typeof ResultSchema>
  try {
    result = await runAIObject({
      model: AI_MODELS.drafter,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: ResultSchema,
      temperature: 0.5,
      maxOutputTokens: 1000,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI call failed'
    log.error({ proposalId: id, err: message }, 'ai_generate_narrative_failed')
    return NextResponse.json({ error: message }, { status: 502 })
  }

  log.info({ proposalId: id, count: result.pairs.length }, 'ai_generate_narrative_ok')
  return NextResponse.json({ ok: true, pairs: result.pairs })
}
