import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    userRole: 'member' as 'owner' | 'admin' | 'member' | 'viewer',
    dbFetchResult: {
      data: null as { id: string; storage_path: string; name: string } | null,
      error: null as { message: string } | null,
    },
    signedUrlResult: {
      data: { signedUrl: 'https://storage.example.com/signed' } as { signedUrl: string } | null,
      error: null as { message: string } | null,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error('Not authenticated')
    return { id: 'user-1', role: state.userRole }
  }),
}))

vi.mock('@/lib/storage', () => ({
  getStorage: () => ({
    upload: async () => ({ error: null }),
    remove: async () => ({ error: null }),
    createSignedUrl: async () => ({
      url: state.signedUrlResult.data?.signedUrl ?? null,
      error: state.signedUrlResult.error?.message ?? null,
    }),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: async () => state.dbFetchResult,
          }),
        }),
      }),
    }),
  })),
}))

import { NextRequest } from 'next/server'

import { GET } from '@/app/api/documents/[id]/download/route'

function downloadRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/documents/${id}/download`)
}

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    state.authThrows = false
    state.userRole = 'member'
    state.dbFetchResult = { data: null, error: null }
    state.signedUrlResult = {
      data: { signedUrl: 'https://storage.example.com/signed' },
      error: null,
    }
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    state.authThrows = true
    const res = await GET(downloadRequest('att-1'), { params: Promise.resolve({ id: 'att-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 for a soft-deleted attachment (deleted_at IS NULL filter)', async () => {
    state.dbFetchResult = { data: null, error: null }
    const res = await GET(downloadRequest('att-deleted'), {
      params: Promise.resolve({ id: 'att-deleted' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when attachment does not exist', async () => {
    state.dbFetchResult = { data: null, error: { message: 'Not found' } }
    const res = await GET(downloadRequest('unknown'), {
      params: Promise.resolve({ id: 'unknown' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when the DB row has no storage_path', async () => {
    state.dbFetchResult = {
      data: { id: 'att-1', storage_path: '', name: 'file.pdf' },
      error: null,
    }
    const res = await GET(downloadRequest('att-1'), { params: Promise.resolve({ id: 'att-1' }) })
    expect(res.status).toBe(400)
  })

  it('redirects to signed URL on success', async () => {
    state.dbFetchResult = {
      data: { id: 'att-1', storage_path: 'lead/l1/att-1/file.pdf', name: 'file.pdf' },
      error: null,
    }
    const res = await GET(downloadRequest('att-1'), { params: Promise.resolve({ id: 'att-1' }) })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://storage.example.com/signed')
  })
})
