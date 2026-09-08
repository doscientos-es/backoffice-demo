import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    googleEnabled: true,
    authThrows: false,
    userRole: 'member' as 'owner' | 'admin' | 'member' | 'viewer',
    metadataResult: {
      id: 'file-1',
      name: 'Especificación técnica',
      mimeType: 'application/vnd.google-apps.document',
      webViewLink: 'https://docs.google.com/document/d/file-1/edit',
      iconLink: 'https://drive-icon.example/doc.png',
    } as {
      id: string
      name: string
      mimeType: string
      webViewLink: string | null
      iconLink: string | null
    } | null,
    metadataError: null as Error | null,
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
    return { id: 'user-1', role: state.userRole, email: 'user@doscientos.es' }
  }),
}))

vi.mock('@/lib/env', () => ({
  isGoogleEnabled: () => state.googleEnabled,
  serverEnv: () => ({ LOG_LEVEL: 'silent' }),
}))

vi.mock('@/lib/google/client', () => ({
  resolveSubject: (email?: string) => email ?? 'pol@doscientos.es',
}))

vi.mock('@/lib/google/drive', () => ({
  extractDriveFileId: (input: string) => {
    const match = input.match(/\/d\/([a-zA-Z0-9_-]{20,})/)
    if (match?.[1]) return match[1]
    if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim()
    return null
  },
  getFileMetadata: vi.fn(async () => {
    if (state.metadataError) throw state.metadataError
    return state.metadataResult
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

import { POST } from '@/app/api/attachments/drive-link/route'

function driveLinkRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/attachments/drive-link', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const validBody = {
  drive_url: 'https://docs.google.com/document/d/abcdefghijklmnopqrstu/edit',
  entityType: 'lead',
  entityId: 'lead-1',
}

describe('POST /api/attachments/drive-link', () => {
  beforeEach(() => {
    state.googleEnabled = true
    state.authThrows = false
    state.userRole = 'member'
    state.metadataResult = {
      id: 'file-1',
      name: 'Especificación técnica',
      mimeType: 'application/vnd.google-apps.document',
      webViewLink: 'https://docs.google.com/document/d/file-1/edit',
      iconLink: 'https://drive-icon.example/doc.png',
    }
    state.metadataError = null
    state.insertedAttachment = null
    state.dbInsertResult = { data: { id: 'att-1' }, error: null }
    vi.resetModules()
  })

  it('returns 503 when Google integration is disabled', async () => {
    state.googleEnabled = false
    const res = await POST(driveLinkRequest(validBody))
    expect(res.status).toBe(503)
  })

  it('returns 401 when not authenticated', async () => {
    state.authThrows = true
    const res = await POST(driveLinkRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    state.userRole = 'viewer'
    const res = await POST(driveLinkRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid body', async () => {
    const res = await POST(driveLinkRequest({ drive_url: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid entityType', async () => {
    const res = await POST(driveLinkRequest({ ...validBody, entityType: 'invoice' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a URL with no extractable file id', async () => {
    const res = await POST(driveLinkRequest({ ...validBody, drive_url: 'not-a-drive-url' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('no válida') })
  })

  it('returns 502 when Drive metadata fetch fails (no permission / not found)', async () => {
    state.metadataError = new Error('File not found: abcdefghijklmnopqrstu')
    const res = await POST(driveLinkRequest(validBody))
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('not found') })
  })

  it('returns 500 on DB insert failure', async () => {
    state.dbInsertResult = { data: null, error: { message: 'constraint violation' } }
    const res = await POST(driveLinkRequest(validBody))
    expect(res.status).toBe(500)
  })

  it('returns 201 with attachment id on success', async () => {
    const res = await POST(driveLinkRequest(validBody))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'att-1' })
  })

  it('associates a Drive invoice with its expense', async () => {
    const res = await POST(
      driveLinkRequest({ ...validBody, entityType: 'expense', entityId: 'expense-1' }),
    )
    expect(res.status).toBe(201)
    expect(state.insertedAttachment).toMatchObject({ expense_id: 'expense-1' })
  })
})
