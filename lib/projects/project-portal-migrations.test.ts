import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = (name: string) =>
  readFileSync(join(process.cwd(), 'supabase', 'migrations', name), 'utf8')

describe('project portal migrations', () => {
  it('limits MCP writes to token-checked RPCs with optimistic concurrency', () => {
    const sql = migration('20260826100000_mcp_project_task_tools.sql')
    expect(sql).toContain('if not public.has_valid_mcp_access_token()')
    expect(sql).toContain('and version = p_expected_version')
    expect(sql).not.toContain('create policy mcp_writer')
  })

  it('keeps public request insertion behind the service role', () => {
    const sql = migration('20260826110000_project_client_portal.sql')
    expect(sql).toContain("if auth.role() <> 'service_role'")
    expect(sql).toContain('grant execute on function public.submit_project_request')
    expect(sql).toContain('to service_role')
    expect(sql).toContain('trg_sync_project_request_from_task')
  })

  it('stores only safe repository-relative workspace paths', () => {
    const sql = migration('20260826120000_project_workspace_paths.sql')
    expect(sql).toContain('are_safe_project_workspace_paths')
    expect(sql).toContain('^[A-Za-z]:')
    expect(sql).toContain('(^|/)\\.\\.?(/|$)')
    expect(sql).toContain('workspace_paths text[] not null')
  })

  it('seeds workspace paths by stable project and client names', () => {
    const sql = migration('20260826130000_project_workspace_paths_seed.sql')
    expect(sql).toContain('from public.clients as client')
    expect(sql).toContain('clients/gruas-del-valles/gv-landing')
    expect(sql).toContain('clients/electrico/crm')
    expect(sql).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )
  })

  it('keeps the request synchronization trigger function internal', () => {
    const sql = migration('20260826140000_restrict_project_request_sync_function.sql')
    expect(sql).toContain('revoke all on function public.sync_project_request_from_task()')
    expect(sql).toContain('from public, anon, authenticated')
  })

  it('records lifecycle email claims for idempotent delivery', () => {
    const sql = migration('20260826200000_project_lifecycle_emails.sql')
    expect(sql).toContain('acceptance_email_sent_at timestamptz')
    expect(sql).toContain('portal_invite_sent_at timestamptz')
    expect(sql).toContain('portal_invite_resend_id text')
  })

  it('keeps web-to-project links optional and indexed for portal lookups', () => {
    const sql = migration('20260826210000_web_projects_project_portal.sql')
    expect(sql).toContain('project_id uuid references public.projects(id) on delete set null')
    expect(sql).toContain('is_client_visible boolean not null default false')
    expect(sql).toContain('create index if not exists web_projects_project_idx')
  })
})
