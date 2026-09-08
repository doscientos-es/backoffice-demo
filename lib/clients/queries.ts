import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

import {
  CLIENT_LIST_PAGE_SIZE,
  CLIENT_PROJECTS_LIMIT,
  CLIENT_RELATED_LIMIT,
  type ClientDetailResult,
  type ClientListParams,
  type ClientListResult,
} from './types'

const log = scopedLogger('clients.queries')

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`)
}

export async function listClients(params: ClientListParams): Promise<ClientListResult> {
  const supabase = await createServerClient()
  const page = Math.max(1, params.page ?? 1)
  const from = (page - 1) * CLIENT_LIST_PAGE_SIZE
  const to = from + CLIENT_LIST_PAGE_SIZE - 1

  let query = notDeleted(
    supabase
      .from('clients')
      .select(
        'id, version, name, label, nif, email, phone, contact_person, billing_address_street, billing_address_zip, billing_address_city, billing_address_province, billing_address_country, notes, logo_url, updated_at',
        { count: 'exact' },
      ),
  )

  if (params.q && params.q.length > 0) {
    const p = `%${escapeIlike(params.q)}%`
    query = query.or(`name.ilike.${p},nif.ilike.${p},email.ilike.${p}`)
  }

  const sortCol = params.sort ?? 'created_at'
  const ascending = params.sort ? params.dir !== 'desc' : false
  const { data, error, count } = await query
    .order(sortCol, { ascending, nullsFirst: false })
    .range(from, to)

  if (error) log.error({ err: error.message }, 'list_clients_failed')

  return {
    data: (data ?? []).map((c) => ({
      id: c.id as string,
      version: Number(c.version),
      name: c.name as string,
      label: (c.label as string | null) ?? null,
      nif: (c.nif as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      phone: (c.phone as string | null) ?? null,
      contact_person: (c.contact_person as string | null) ?? null,
      billing_address_street: (c.billing_address_street as string | null) ?? null,
      billing_address_zip: (c.billing_address_zip as string | null) ?? null,
      billing_address_city: (c.billing_address_city as string | null) ?? null,
      billing_address_province: (c.billing_address_province as string | null) ?? null,
      billing_address_country: (c.billing_address_country as string | null) ?? null,
      notes: (c.notes as string | null) ?? null,
      logo_url: (c.logo_url as string | null) ?? null,
      updated_at: (c.updated_at as string | null) ?? null,
    })),
    count: count ?? 0,
  }
}

export async function getClientDetail(id: string): Promise<ClientDetailResult> {
  const supabase = await createServerClient()

  const { data: client, error } = await notDeleted(
    supabase.from('clients').select('*, leads(id, name, company)').eq('id', id),
  ).maybeSingle()

  if (error) log.error({ clientId: id, err: error.message }, 'get_client_detail_failed')
  if (!client) return null

  const [
    { data: projects },
    { data: proposals },
    { data: invoices },
    { data: tasks },
    { data: reminders },
    { data: webs },
  ] = await Promise.all([
    notDeleted(supabase.from('projects').select('id, name, status').eq('client_id', id))
      .order('created_at', { ascending: false })
      .limit(CLIENT_PROJECTS_LIMIT),
    notDeleted(
      supabase.from('proposals').select('id, number, title, status, total').eq('client_id', id),
    )
      .order('created_at', { ascending: false })
      .limit(CLIENT_RELATED_LIMIT),
    notDeleted(
      supabase
        .from('invoices')
        .select('id, full_number, status, total, issue_date')
        .eq('client_id', id),
    )
      .order('issue_date', { ascending: false })
      .limit(CLIENT_RELATED_LIMIT),
    notDeleted(
      supabase
        .from('tasks')
        .select('id, title, status, due_date')
        .eq('kind', 'task')
        .eq('client_id', id),
    )
      .order('created_at', { ascending: false })
      .limit(CLIENT_RELATED_LIMIT),
    supabase
      .from('tasks')
      .select('id, title, start_at')
      .eq('kind', 'reminder')
      .eq('client_id', id)
      .is('completed_at', null)
      .is('deleted_at', null)
      .order('start_at', { ascending: true })
      .limit(CLIENT_RELATED_LIMIT),
    notDeleted(
      supabase
        .from('web_projects')
        .select('id, name, url, project_id, is_client_visible, projects(name)')
        .eq('client_id', id),
    ).order('name'),
  ])

  return {
    client: {
      id: client.id as string,
      version: Number(client.version),
      name: client.name as string,
      label: (client.label as string | null) ?? null,
      nif: (client.nif as string | null) ?? null,
      email: (client.email as string | null) ?? null,
      phone: (client.phone as string | null) ?? null,
      contact_person: (client.contact_person as string | null) ?? null,
      billing_address_street: (client.billing_address_street as string | null) ?? null,
      billing_address_zip: (client.billing_address_zip as string | null) ?? null,
      billing_address_city: (client.billing_address_city as string | null) ?? null,
      billing_address_province: (client.billing_address_province as string | null) ?? null,
      billing_address_country: (client.billing_address_country as string | null) ?? null,
      notes: (client.notes as string | null) ?? null,
      logo_url: (client.logo_url as string | null) ?? null,
      fiscal_verification_status:
        client.fiscal_verification_status as import('./types').FiscalVerificationStatus,
      fiscal_verified_at: (client.fiscal_verified_at as string | null) ?? null,
      created_at: (client.created_at as string | null) ?? null,
      updated_at: (client.updated_at as string | null) ?? null,
    },
    originLead: (() => {
      const lead = (client as unknown as {
        leads: { id: string; name: string; company: string | null } | null
      }).leads

      return lead
        ? {
            id: lead.id,
            name: lead.name,
            company: lead.company,
          }
        : null
    })(),
    projects: (projects ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      status: (p.status as string | null) ?? null,
    })),
    proposals: (proposals ?? []).map((p) => ({
      id: p.id as string,
      number: (p.number as string | null) ?? null,
      title: (p.title as string | null) ?? null,
      status: (p.status as string | null) ?? null,
      total: p.total == null ? null : Number(p.total),
    })),
    invoices: (invoices ?? []).map((i) => ({
      id: i.id as string,
      full_number: (i.full_number as string | null) ?? null,
      status: (i.status as string | null) ?? null,
      total: i.total == null ? null : Number(i.total),
      issue_date: (i.issue_date as string | null) ?? null,
    })),
    tasks: (tasks ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      status: t.status as string,
      due_date: (t.due_date as string | null) ?? null,
    })),
    reminders: (reminders ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      remind_at: r.start_at as string,
    })),
    webs: (webs ?? []).map((web) => ({
      id: web.id as string,
      name: web.name as string,
      url: web.url as string,
      project_id: (web.project_id as string | null) ?? null,
      project_name:
        (web as unknown as { projects: { name: string } | null }).projects?.name ?? null,
      is_client_visible: Boolean(web.is_client_visible),
    })),
  }
}
