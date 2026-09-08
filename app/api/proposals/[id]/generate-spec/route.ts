/**
 * POST /api/proposals/[id]/generate-spec
 *
 * Genera una especificación técnica (markdown estructurado) para una propuesta
 * de software a medida. El documento se inserta como `technical_spec` en la
 * tabla `documents` enlazado a la propuesta, y se devuelve su id para que el
 * cliente pueda navegar a editarlo o marcarlo como visible.
 *
 * Auth: requireUser (viewer denegado).
 * 503 si la IA no está configurada (isAIEnabled() falsy).
 */

import { type NextRequest, NextResponse } from 'next/server'

import { AI_MODELS, isAIEnabled, runAIChat } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('ai.generate-spec')

const SYSTEM_PROMPT = `Eres un arquitecto de software senior en una agencia española
que construye productos digitales a medida. Tu tarea es producir una
especificación técnica clara para una propuesta concreta, en formato
markdown, lista para que el cliente la lea y firme.

Reglas estrictas:
- Devuelve SOLO markdown (sin bloques de código envolventes, sin preámbulo).
- Usa encabezados ## para cada sección y ### para subsecciones.
- Usa listas con guiones para enumeraciones.
- Idioma: español neutro, tono profesional pero accesible.
- Si falta información, propón asunciones razonables marcadas como "Supuesto:".
- No inventes precios, plazos ni nombres de personas que no estén en el contexto.

Estructura obligatoria (en este orden):
## 1. Resumen ejecutivo
## 2. Alcance funcional
## 3. Fuera de alcance
## 4. Stack y arquitectura
## 5. Modelo de datos
## 6. Integraciones externas
## 7. Entornos, despliegue y dominios
## 8. Seguridad y cumplimiento
## 9. Plan de hitos
## 10. Supuestos y riesgos
## 11. Criterios de aceptación`

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
      'id, number, title, notes, project_id, client_id, clients(name), projects(name, description)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!proposal) {
    return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 })
  }

  const { data: items } = await supabase
    .from('proposal_items')
    .select('description, quantity, unit_price')
    .eq('proposal_id', id)
    .order('position')

  const client = (
    proposal as unknown as {
      clients: { name: string } | null
    }
  ).clients
  const project = (
    proposal as unknown as {
      projects: { name: string; description: string | null } | null
    }
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
Notas de la propuesta: ${(proposal.notes as string | null) ?? '—'}

Líneas de la propuesta:
${itemsText || '(sin líneas)'}

Genera la especificación técnica completa siguiendo la estructura indicada.`

  let markdown: string
  try {
    markdown = await runAIChat({
      model: AI_MODELS.drafter,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.4,
      maxOutputTokens: 4000,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI call failed'
    log.error({ proposalId: id, err: message }, 'ai_generate_spec_failed')
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const title = `Especificación técnica · ${proposal.title as string}`

  const { data: doc, error: insertErr } = await supabase
    .from('proposal_specs')
    .insert({
      title,
      body_markdown: markdown,
      proposal_id: id,
      project_id: (proposal as { project_id: string | null }).project_id,
      client_id: (proposal as { client_id: string }).client_id,
      is_client_visible: false,
      created_by: user.id,
    })
    .select('id, portal_token')
    .single()

  if (insertErr || !doc) {
    log.error({ proposalId: id, err: insertErr?.message }, 'ai_generate_spec_persist_failed')
    return NextResponse.json(
      { error: insertErr?.message ?? 'No se pudo guardar la spec' },
      { status: 500 },
    )
  }

  log.info({ proposalId: id, docId: doc.id }, 'ai_generate_spec_ok')
  return NextResponse.json({ ok: true, id: doc.id, portal_token: doc.portal_token })
}
