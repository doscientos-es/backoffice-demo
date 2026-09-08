/**
 * GET /api/search?q=...
 *
 * Búsqueda global ligera para el Command Palette (⌘K).
 * Devuelve coincidencias en leads, clients, projects, invoices y tasks.
 * Cada grupo se limita a 5 resultados para mantener la respuesta breve.
 */

import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { VAULT_SERVICE_LABELS, type VaultService } from '@/lib/schemas/vault'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type SearchResultItem = {
  id: string
  type: 'lead' | 'client' | 'project' | 'invoice' | 'task' | 'vault'
  label: string
  sublabel?: string | null
  href: string
  /**
   * Only present for vault items. Gates copy/reveal behind the master password
   * on the client. The secret itself is never sent here — it is decrypted on
   * demand via the `vault.reveal` server action.
   */
  isSensitive?: boolean
}

const PER_GROUP = 5

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  await requireUser()

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 1) {
    return NextResponse.json({ items: [] satisfies SearchResultItem[] })
  }

  const supabase = await createServerClient()
  const pattern = `%${escapeIlike(q)}%`

  const [leadsRes, clientsRes, projectsRes, invoicesRes, tasksRes, vaultRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, company, email')
      .is('deleted_at', null)
      .or(`name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`)
      .order('updated_at', { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from('clients')
      .select('id, name, nif, email')
      .is('deleted_at', null)
      .or(`name.ilike.${pattern},nif.ilike.${pattern},email.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from('projects')
      .select('id, name, status')
      .is('deleted_at', null)
      .ilike('name', pattern)
      .order('created_at', { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from('invoices')
      .select('id, full_number, idfact, status')
      .is('deleted_at', null)
      .or(`full_number.ilike.${pattern},idfact.ilike.${pattern}`)
      .order('issue_date', { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from('tasks')
      .select('id, title, status')
      .is('deleted_at', null)
      .ilike('title', pattern)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(PER_GROUP),
    supabase
      .from('vault_items')
      .select('id, name, service, username, is_sensitive')
      .is('deleted_at', null)
      .or(`name.ilike.${pattern},service.ilike.${pattern},username.ilike.${pattern}`)
      .order('name')
      .limit(PER_GROUP),
  ])

  const items: SearchResultItem[] = []

  for (const r of leadsRes.data ?? []) {
    items.push({
      id: `lead-${r.id as string}`,
      type: 'lead',
      label: r.name as string,
      sublabel: (r.company as string | null) ?? (r.email as string | null) ?? null,
      href: `/leads/${r.id as string}`,
    })
  }
  for (const r of clientsRes.data ?? []) {
    items.push({
      id: `client-${r.id as string}`,
      type: 'client',
      label: r.name as string,
      sublabel: (r.nif as string | null) ?? (r.email as string | null) ?? null,
      href: `/clients/${r.id as string}`,
    })
  }
  for (const r of projectsRes.data ?? []) {
    items.push({
      id: `project-${r.id as string}`,
      type: 'project',
      label: r.name as string,
      sublabel: (r.status as string | null) ?? null,
      href: `/projects/${r.id as string}`,
    })
  }
  for (const r of invoicesRes.data ?? []) {
    items.push({
      id: `invoice-${r.id as string}`,
      type: 'invoice',
      label: (r.full_number as string) ?? (r.idfact as string) ?? 'Factura',
      sublabel: (r.status as string | null) ?? null,
      href: `/invoices/${r.id as string}`,
    })
  }
  for (const r of tasksRes.data ?? []) {
    items.push({
      id: `task-${r.id as string}`,
      type: 'task',
      label: r.title as string,
      sublabel: (r.status as string | null) ?? null,
      href: `/tasks/${r.id as string}`,
    })
  }
  for (const r of vaultRes.data ?? []) {
    const service = r.service as string
    items.push({
      id: `vault-${r.id as string}`,
      type: 'vault',
      label: r.name as string,
      sublabel:
        VAULT_SERVICE_LABELS[service as VaultService] ?? (r.username as string | null) ?? service,
      href: '/vault',
      isSensitive: !!(r.is_sensitive as boolean),
    })
  }

  return NextResponse.json({ items })
}
