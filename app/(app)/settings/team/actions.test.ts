import { beforeEach, describe, expect, it, vi } from 'vitest'

type InviteOpts = { data: { name?: string }; redirectTo: string }

const { state } = vi.hoisted(() => ({
  state: {
    actorRole: 'owner' as 'owner' | 'admin' | 'member' | 'viewer',
    inviteCalls: [] as Array<{ email: string; opts: InviteOpts }>,
    inviteResult: {
      data: {
        user: { id: '11111111-1111-1111-1111-111111111111' },
        properties: { hashed_token: 'mock-token' },
      },
      error: null as null | { message: string },
    },
    upsertCalls: [] as Array<{ row: Record<string, unknown>; opts: unknown }>,
    upsertResult: { error: null as null | { message: string } },
  },
}))

vi.mock('@/lib/auth', () => ({
  // Mirrors the real guard: redirect() (which throws a NEXT_REDIRECT error)
  // when the actor's role is not in the allowed list.
  requireRole: vi.fn(async (roles: string[]) => {
    if (!roles.includes(state.actorRole)) {
      const err = new Error('NEXT_REDIRECT') as Error & { digest: string }
      err.digest = 'NEXT_REDIRECT;replace;/inicio?error=forbidden;307;'
      throw err
    }
    return {
      id: '00000000-0000-0000-0000-000000000000',
      role: state.actorRole,
    }
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  generateAuthLink: async (params: {
    email: string
    data?: { name?: string }
    redirectTo?: string
  }) => {
    state.inviteCalls.push({
      email: params.email,
      opts: { data: params.data ?? {}, redirectTo: params.redirectTo ?? '' },
    })
    return state.inviteResult
  },
  createAdminClient: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>, opts: unknown) => {
        state.upsertCalls.push({ row, opts })
        return state.upsertResult
      },
    }),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { inviteTeamMember, updateMemberRole } from '@/app/(app)/settings/team/actions'

function form(email: string, name: string | null = 'Test User', role = 'member') {
  const fd = new FormData()
  if (name !== null) fd.set('name', name)
  fd.set('email', email)
  fd.set('role', role)
  return fd
}

describe('inviteTeamMember', () => {
  beforeEach(() => {
    state.actorRole = 'owner'
    state.inviteCalls = []
    state.upsertCalls = []
    state.inviteResult = {
      data: {
        user: { id: '11111111-1111-1111-1111-111111111111' },
        properties: { hashed_token: 'mock-token' },
      },
      error: null,
    }
    state.upsertResult = { error: null }
  })

  it('routes redirectTo through /auth/callback with the onboarding next', async () => {
    const res = await inviteTeamMember(form('nuevo@doscientos.es'))
    expect(res).toEqual({ ok: true })
    expect(state.inviteCalls).toHaveLength(1)
    const opts = state.inviteCalls[0]?.opts
    expect(opts?.redirectTo).toMatch(/\/auth\/callback/)
    // Google-first: it must NOT force a password step on the invitee.
    expect(opts?.redirectTo).not.toMatch(/update-password/)
  })

  it('lowercases and trims the email before inviting and upserting', async () => {
    await inviteTeamMember(form('  Nuevo@DosCientos.ES '))
    expect(state.inviteCalls[0]?.email).toBe('nuevo@doscientos.es')
    expect(state.upsertCalls[0]?.row.email).toBe('nuevo@doscientos.es')
  })

  it('forwards the invitee name as user metadata', async () => {
    await inviteTeamMember(form('ada@doscientos.es', 'Ada Lovelace'))
    expect(state.inviteCalls[0]?.opts.data).toEqual({ name: 'Ada Lovelace' })
  })

  it('derives the name from the email local-part when omitted', async () => {
    await inviteTeamMember(form('ada@doscientos.es', null))
    expect(state.inviteCalls[0]?.opts.data).toEqual({ name: 'ada' })
    expect(state.upsertCalls[0]?.row.name).toBe('ada')
  })

  it('accepts emails from any domain (external collaborators)', async () => {
    const res = await inviteTeamMember(form('ada@gmail.com'))
    expect(res).toEqual({ ok: true })
    expect(state.inviteCalls[0]?.email).toBe('ada@gmail.com')
  })

  it('upserts the team_members row with the invited auth user id', async () => {
    await inviteTeamMember(form('ada@doscientos.es', 'Ada', 'admin'))
    const row = state.upsertCalls[0]?.row
    expect(row?.id).toBe('11111111-1111-1111-1111-111111111111')
    expect(row?.role).toBe('admin')
    expect(row?.deleted_at).toBeNull()
  })

  it('rejects when an admin tries to assign the owner role', async () => {
    state.actorRole = 'admin'
    const res = await inviteTeamMember(form('ada@doscientos.es', 'Ada', 'owner'))
    expect(res).toEqual({ ok: false, error: 'No tienes permisos para asignar ese rol.' })
    expect(state.inviteCalls).toHaveLength(0)
  })

  it('propagates Supabase invite errors', async () => {
    state.inviteResult = {
      data: {
        user: null as unknown as { id: string },
        properties: null as unknown as { hashed_token: string },
      },
      error: { message: 'rate limited' },
    }
    const res = await inviteTeamMember(form('ada@doscientos.es'))
    expect(res).toEqual({
      ok: false,
      error: 'Límite de emails alcanzado. Espera unos minutos antes de reintentar.',
    })
    expect(state.upsertCalls).toHaveLength(0)
  })
})

describe('updateMemberRole', () => {
  const OTHER = '22222222-2222-2222-2222-222222222222'
  const SELF = '00000000-0000-0000-0000-000000000000'

  beforeEach(() => {
    state.actorRole = 'owner'
  })

  it("blocks a member from changing another member's role", async () => {
    state.actorRole = 'member'
    await expect(updateMemberRole({ memberId: OTHER, role: 'owner' })).rejects.toThrow(
      'NEXT_REDIRECT',
    )
  })

  it('blocks a member from changing their own role', async () => {
    state.actorRole = 'member'
    await expect(updateMemberRole({ memberId: SELF, role: 'owner' })).rejects.toThrow(
      'NEXT_REDIRECT',
    )
  })

  it('blocks a viewer from changing roles', async () => {
    state.actorRole = 'viewer'
    await expect(updateMemberRole({ memberId: OTHER, role: 'admin' })).rejects.toThrow(
      'NEXT_REDIRECT',
    )
  })
})
