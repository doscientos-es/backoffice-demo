import { beforeEach, describe, expect, it, vi } from 'vitest'

import { importInstagramPost } from './repo/posts'
import { mapInstagramMedia } from './service'

const state = vi.hoisted(() => ({
  existing: null as { id: string } | null,
  insertedPost: null as Record<string, unknown> | null,
  insertedTarget: null as Record<string, unknown> | null,
  fromCalls: 0,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      state.fromCalls += 1
      if (table === 'social_post_targets' && state.fromCalls === 1) {
        const lookup = {
          select: () => lookup,
          eq: () => lookup,
          maybeSingle: async () => ({ data: state.existing, error: null }),
        }
        return lookup
      }
      if (table === 'social_posts') {
        const posts = {
          insert: (row: Record<string, unknown>) => {
            state.insertedPost = row
            return posts
          },
          select: () => posts,
          single: async () => ({ data: { id: 'post-imported' }, error: null }),
        }
        return posts
      }
      const targets = {
        insert: async (row: Record<string, unknown>) => {
          state.insertedTarget = row
          return { error: null }
        },
      }
      return targets
    },
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('mapInstagramMedia', () => {
  it('maps carousel children and keeps the remote identity', () => {
    const result = mapInstagramMedia({
      id: 'ig-carousel',
      caption: 'Histórico',
      media_type: 'CAROUSEL_ALBUM',
      permalink: 'https://instagram.com/p/abc',
      timestamp: '2026-01-02T10:00:00+0000',
      children: {
        data: [
          { id: 'child-1', media_type: 'IMAGE', media_url: 'https://cdn/image.jpg' },
          { id: 'child-2', media_type: 'VIDEO', media_url: 'https://cdn/video.mp4' },
        ],
      },
    })

    expect(result).toMatchObject({
      remoteId: 'ig-carousel',
      remoteUrl: 'https://instagram.com/p/abc',
      caption: 'Histórico',
      publishedAt: '2026-01-02T10:00:00+0000',
    })
    expect(result.media).toEqual([
      { storagePath: '', publicUrl: 'https://cdn/image.jpg', type: 'image', mime: 'image/jpeg' },
      { storagePath: '', publicUrl: 'https://cdn/video.mp4', type: 'video', mime: 'video/mp4' },
    ])
  })
})

describe('importInstagramPost', () => {
  beforeEach(() => {
    state.existing = null
    state.insertedPost = null
    state.insertedTarget = null
    state.fromCalls = 0
  })

  it('skips a remote target that was already imported', async () => {
    state.existing = { id: 'target-existing' }
    await expect(
      importInstagramPost({
        remoteId: 'ig-1',
        remoteUrl: null,
        caption: '',
        media: [],
        publishedAt: null,
      }),
    ).resolves.toBe('skipped')
    expect(state.insertedPost).toBeNull()
  })

  it('creates a published post and target for a new remote item', async () => {
    await expect(
      importInstagramPost({
        remoteId: 'ig-2',
        remoteUrl: 'https://instagram.com/p/xyz',
        caption: 'Nueva',
        media: [],
        publishedAt: '2026-01-02T10:00:00.000Z',
      }),
    ).resolves.toBe('imported')
    expect(state.insertedPost).toMatchObject({
      caption: 'Nueva',
      media_kind: 'text',
      status: 'published',
      created_at: '2026-01-02T10:00:00.000Z',
    })
    expect(state.insertedTarget).toMatchObject({
      post_id: 'post-imported',
      platform: 'instagram',
      remote_id: 'ig-2',
      status: 'published',
    })
  })
})
