import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20260903120000_grant_mcp_proposal_item_select.sql'),
  'utf8',
)

describe('MCP proposal-item reader migration', () => {
  it('grants read-only, token-gated access to proposal line items', () => {
    expect(migration).toContain('grant select on table public.proposal_items to anon')
    expect(migration).toContain('create policy mcp_reader_select on public.proposal_items')
    expect(migration).toContain('for select to anon')
    expect(migration).toContain('using (public.has_valid_mcp_access_token())')
    expect(migration).not.toContain('grant insert on table public.proposal_items')
  })
})