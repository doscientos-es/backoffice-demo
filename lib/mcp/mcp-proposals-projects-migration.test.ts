import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20260903110000_mcp_proposals_projects.sql'),
  'utf8',
)

describe('MCP proposal and project mutation migration', () => {
  it('keeps every mutation behind a token-checked RPC with optimistic concurrency', () => {
    expect(migration).toContain('if not public.has_valid_mcp_access_token()')
    expect(migration).toContain('v_current.version <> p_expected_version')
    expect(migration).not.toContain('create policy mcp_writer')
  })

  it('enforces one proposal target and validates the client-lead-project graph', () => {
    expect(migration).toContain('Provide exactly one commercial target: client or lead')
    expect(migration).toContain('Project client is not linked to this lead')
    expect(migration).toContain('Client is not linked to the supplied lead')
    expect(migration).toContain('trg_enforce_proposal_project_commercial_relationship')
  })

  it('limits execution to the four public MCP entrypoints', () => {
    expect(migration).toContain('grant execute on function public.mcp_create_proposal')
    expect(migration).toContain('grant execute on function public.mcp_update_proposal')
    expect(migration).toContain('grant execute on function public.mcp_create_project')
    expect(migration).toContain('grant execute on function public.mcp_update_project')
    expect(migration).toContain('revoke all on function public.mcp_validate_proposal_items')
  })
})
