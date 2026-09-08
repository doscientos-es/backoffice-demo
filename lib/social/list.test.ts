import { describe, expect, it } from 'vitest'

import type { PostListItem } from '@/lib/social/types'

import { filterAndSortPosts } from './list'

const posts: PostListItem[] = [
  {
    id: 'draft',
    caption: 'Plan de verano',
    mediaKind: 'photo',
    media: [],
    status: 'draft',
    scheduledAt: null,
    publishedAt: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    targets: [
      {
        id: 'draft-target',
        platform: 'instagram',
        status: 'pending',
        caption: null,
        remoteId: null,
        remoteUrl: null,
        error: null,
        publishedAt: null,
      },
    ],
    metrics: { likes: 0, comments: 0, actions: 0 },
  },
  {
    id: 'published',
    caption: 'Lanzamiento de producto',
    mediaKind: 'video',
    media: [],
    status: 'published',
    scheduledAt: null,
    publishedAt: '2026-07-02T10:00:00.000Z',
    createdAt: '2026-07-02T09:00:00.000Z',
    targets: [
      {
        id: 'published-target',
        platform: 'facebook',
        status: 'published',
        caption: null,
        remoteId: 'remote-1',
        remoteUrl: null,
        error: null,
        publishedAt: '2026-07-02T10:00:00.000Z',
      },
    ],
    metrics: { likes: 12, comments: 3, actions: 0 },
  },
]

describe('filterAndSortPosts', () => {
  it('filters by status, platform, media and caption', () => {
    const result = filterAndSortPosts(posts, {
      q: 'lanzamiento',
      status: 'published',
      platform: 'facebook',
      mediaKind: 'video',
    })

    expect(result.map((post) => post.id)).toEqual(['published'])
  })

  it('sorts posts by engagement without mutating the input', () => {
    const result = filterAndSortPosts(posts, { sort: 'engagement_desc' })

    expect(result.map((post) => post.id)).toEqual(['published', 'draft'])
    expect(posts[0]?.id).toBe('draft')
  })
})
