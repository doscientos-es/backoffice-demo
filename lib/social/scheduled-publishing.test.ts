import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  dueIds: ['post-1', 'post-2'],
  claim: vi.fn(),
  getPost: vi.fn(),
  applyFanOut: vi.fn(),
  fanOutPublish: vi.fn(),
}))

vi.mock('@/lib/social/repo', () => ({
  listDueScheduledPostIds: vi.fn(async () => state.dueIds),
  claimDueScheduledPost: state.claim,
  getScheduledPostForPublishing: state.getPost,
  applyFanOut: state.applyFanOut,
}))

vi.mock('@/lib/social/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/social/core')>()),
  fanOutPublish: state.fanOutPublish,
}))

vi.mock('@/lib/social/registry', () => ({ socialRegistry: vi.fn(() => ({})) }))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

import { publishDueScheduledPosts } from './service'

const post = {
  id: 'post-1',
  caption: 'Post programado',
  mediaKind: 'photo' as const,
  media: [
    {
      storagePath: 'social/image.jpg',
      publicUrl: 'https://example.com/image.jpg',
      type: 'image' as const,
      mime: 'image/jpeg',
    },
  ],
  status: 'publishing' as const,
  scheduledAt: '2026-09-04T08:50:00.000Z',
  publishedAt: null,
  createdAt: '2026-09-01T20:53:00.000Z',
  metrics: { likes: 0, comments: 0, actions: 0 },
  targets: [
    {
      id: 'target-1',
      platform: 'instagram' as const,
      status: 'publishing' as const,
      caption: null,
      remoteId: null,
      remoteUrl: null,
      error: null,
      publishedAt: null,
    },
  ],
}

describe('publishDueScheduledPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.dueIds = ['post-1', 'post-2']
    state.claim.mockImplementation(async (id: string) => id === 'post-1')
    state.getPost.mockResolvedValue(post)
    state.fanOutPublish.mockResolvedValue({
      status: 'published',
      targets: [{ platform: 'instagram', ok: true, remoteId: 'remote-1', remoteUrl: null }],
    })
  })

  it('publishes claimed due posts and skips those claimed elsewhere', async () => {
    await expect(publishDueScheduledPosts(new Date('2026-09-04T09:00:00.000Z'))).resolves.toEqual({
      checked: 2,
      published: 1,
      partiallyFailed: 0,
      failed: 0,
      skipped: 1,
    })

    expect(state.claim).toHaveBeenCalledWith('post-1', '2026-09-04T09:00:00.000Z')
    expect(state.claim).toHaveBeenCalledWith('post-2', '2026-09-04T09:00:00.000Z')
    expect(state.applyFanOut).toHaveBeenCalledWith(
      'post-1',
      expect.objectContaining({ status: 'published' }),
      true,
    )
  })
})
