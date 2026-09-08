import { scopedLogger } from '@/lib/logger'
import { notDeleted } from '@/lib/supabase/filters'
import { createServerClient } from '@/lib/supabase/server'

import type { WebProjectDetail, WebProjectListItem } from './types'

const log = scopedLogger('webs.queries')

export async function listWebProjects(): Promise<WebProjectListItem[]> {
  const supabase = await createServerClient()
  const { data, error } = await notDeleted(
    supabase
      .from('web_projects')
      .select(
        'id, name, url, client_id, project_id, is_client_visible, is_own, hosting_provider, domain_expires_at, tech_stack, updated_at, clients(name), projects(name)',
      ),
  )
    .order('is_own', { ascending: false })
    .order('name')

  if (error) log.error({ err: error.message }, 'list_web_projects_failed')

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    url: r.url as string,
    client_id: (r.client_id as string | null) ?? null,
    client_name: (r as unknown as { clients: { name: string } | null }).clients?.name ?? null,
    project_id: (r.project_id as string | null) ?? null,
    project_name: (r as unknown as { projects: { name: string } | null }).projects?.name ?? null,
    is_client_visible: Boolean(r.is_client_visible),
    is_own: (r.is_own as boolean) ?? false,
    hosting_provider: (r.hosting_provider as string | null) ?? null,
    domain_expires_at: (r.domain_expires_at as string | null) ?? null,
    tech_stack: (r.tech_stack as string[]) ?? [],
    updated_at: (r.updated_at as string | null) ?? null,
  }))
}

export async function getWebProject(id: string): Promise<WebProjectDetail | null> {
  const supabase = await createServerClient()
  const { data, error } = await notDeleted(
    supabase.from('web_projects').select('*, projects(name)').eq('id', id),
  ).maybeSingle()

  if (error) log.error({ id, err: error.message }, 'get_web_project_failed')
  if (!data) return null

  return {
    id: data.id as string,
    name: data.name as string,
    url: data.url as string,
    client_id: (data.client_id as string | null) ?? null,
    project_id: (data.project_id as string | null) ?? null,
    project_name: (data as unknown as { projects: { name: string } | null }).projects?.name ?? null,
    is_client_visible: Boolean(data.is_client_visible),
    is_own: (data.is_own as boolean) ?? false,
    hosting_provider: (data.hosting_provider as string | null) ?? null,
    hosting_url: (data.hosting_url as string | null) ?? null,
    domain_registrar: (data.domain_registrar as string | null) ?? null,
    domain_expires_at: (data.domain_expires_at as string | null) ?? null,
    tech_stack: (data.tech_stack as string[]) ?? [],
    notes: (data.notes as string | null) ?? null,
    backup_slug: (data.backup_slug as string | null) ?? null,
    db_host: (data.db_host as string | null) ?? null,
    db_port: (data.db_port as number | null) ?? null,
    db_name: (data.db_name as string | null) ?? null,
    db_user: (data.db_user as string | null) ?? null,
    has_db_password: Boolean(data.db_pass_encrypted),
    updated_at: (data.updated_at as string | null) ?? null,
  }
}
