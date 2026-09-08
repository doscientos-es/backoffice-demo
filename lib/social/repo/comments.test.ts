import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listCommentsForTargets } from './comments'

const state = vi.hoisted(() => ({
  client: { from: vi.fn() },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => state.client),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

describe('listCommentsForTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns no comments without querying when a post has no targets', async () => {
    await expect(listCommentsForTargets([])).resolves.toEqual([])
    expect(state.client.from).not.toHaveBeenCalled()
  })

  it('filters comments by target ids and maps the joined post context', async () => {
    const builder = {
      select: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
    }
    builder.select.mockReturnValue(builder)
    builder.in.mockReturnValue(builder)
    builder.order.mockResolvedValue({
      data: [
        {
          id: 'comment-1',
          target_id: 'target-1',
          platform: 'instagram',
          remote_comment_id: 'remote-1',
          author_name: 'Ana',
          text: 'Muy buena publicación',
          like_count: 3,
          replied: false,
          published_at: '2026-07-16T10:00:00.000Z',
          social_post_targets: {
            post_id: 'post-1',
            social_posts: { caption: 'Nuestra publicación' },
          },
        },
      ],
      error: null,
    })
    state.client.from.mockReturnValue(builder)

    await expect(listCommentsForTargets(['target-1', 'target-2'])).resolves.toEqual([
      {
        id: 'comment-1',
        targetId: 'target-1',
        platform: 'instagram',
        remoteCommentId: 'remote-1',
        authorName: 'Ana',
        text: 'Muy buena publicación',
        likeCount: 3,
        replied: false,
        publishedAt: '2026-07-16T10:00:00.000Z',
        postId: 'post-1',
        postCaption: 'Nuestra publicación',
      },
    ])
    expect(state.client.from).toHaveBeenCalledWith('social_comments')
    expect(builder.in).toHaveBeenCalledWith('target_id', ['target-1', 'target-2'])
    expect(builder.order).toHaveBeenCalledWith('published_at', { ascending: false })
  })
})
