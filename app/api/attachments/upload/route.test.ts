import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    userRole: 'member' as 'owner' | 'admin' | 'member' | 'viewer',
    storageUploadError: null as { message: string } | null,
    storageRemoveCalls: [] as string[][],
    insertedAttachment: null as Record<string, unknown> | null,
    dbInsertResult: { data: { id: 'att-1' }, error: null } as {
      data: { id: string } | null
      error: { message: string } | null
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
    upload: async () => ({ error: state.storageUploadError?.message ?? null }),
    remove: async (_bucket: string, paths: string[]) => {
      state.storageRemoveCalls.push(paths)
      return { error: null }
    },
    createSignedUrl: async () => ({ url: null, error: null }),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (_table: string) => ({
      insert: (input: Record<string, unknown>) => {
        state.insertedAttachment = input
        return {
          select: () => ({
            single: async () => state.dbInsertResult,
          }),
        }
      },
    }),
  })),
}))

import { NextRequest } from 'next/server'

import { POST } from '@/app/api/attachments/upload/route'

function makePdf(sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], 'test.pdf', { type: 'application/pdf' })
}

function uploadRequest(file: File, extras: Record<string, string> = {}): NextRequest {
  const fd = new FormData()
  fd.set('file', file)
  for (const [k, v] of Object.entries(extras)) fd.set(k, v)
  return new NextRequest('http://localhost/api/attachments/upload', { method: 'POST', body: fd })
}

describe('POST /api/attachments/upload', () => {
  beforeEach(() => {
    state.authThrows = false
    state.userRole = 'member'
    state.storageUploadError = null
    state.storageRemoveCalls = []
    state.insertedAttachment = null
    state.dbInsertResult = { data: { id: 'att-1' }, error: null }
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    state.authThrows = true
    expect((await POST(uploadRequest(makePdf()))).status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    state.userRole = 'viewer'
    expect((await POST(uploadRequest(makePdf()))).status).toBe(403)
  })

  it('returns 413 when file exceeds 50 MB', async () => {
    const big = new File([new Uint8Array(52_428_801)], 'big.pdf', { type: 'application/pdf' })
    expect((await POST(uploadRequest(big))).status).toBe(413)
  }, 30_000)

  it('returns 400 for disallowed MIME type', async () => {
    const zip = new File([new Uint8Array(100)], 'archive.zip', { type: 'application/zip' })
    const res = await POST(uploadRequest(zip))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('no permitido') })
  })

  it('returns 400 for invalid entityType', async () => {
    const res = await POST(uploadRequest(makePdf(), { entityType: 'invoice', entityId: 'id' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 and rolls back storage on DB failure', async () => {
    state.dbInsertResult = { data: null, error: { message: 'constraint violation' } }
    const res = await POST(uploadRequest(makePdf(), { entityType: 'lead', entityId: 'lead-1' }))
    expect(res.status).toBe(500)
    expect(state.storageRemoveCalls).toHaveLength(1)
  })

  it('returns 201 with attachment id on success', async () => {
    const res = await POST(uploadRequest(makePdf(), { entityType: 'lead', entityId: 'lead-1' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'att-1' })
  })

  it('associates a received invoice with its expense', async () => {
    const res = await POST(
      uploadRequest(makePdf(), { entityType: 'expense', entityId: 'expense-1' }),
    )
    expect(res.status).toBe(201)
    expect(state.insertedAttachment).toMatchObject({ expense_id: 'expense-1' })
  })
})
