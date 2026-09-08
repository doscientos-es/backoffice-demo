import { describe, expect, it } from 'vitest'

import { parseMetaCommentEvents } from './webhook'

describe('Meta social comment webhook', () => {
  it('normalizes an Instagram comment event', () => {
    const events = parseMetaCommentEvents({
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          changes: [
            {
              field: 'comments',
              value: {
                id: 'ig-comment-1',
                text: 'Quiero doscientos',
                media: { id: 'ig-media-1' },
                from: { id: 'person-1', username: 'ana' },
              },
            },
          ],
        },
      ],
    })

    expect(events).toEqual([
      expect.objectContaining({
        platform: 'instagram',
        sourceId: 'ig-account-1',
        remotePostId: 'ig-media-1',
        remoteCommentId: 'ig-comment-1',
        text: 'Quiero doscientos',
        authorName: 'ana',
      }),
    ])
  })

  it('normalizes Facebook feed comment events and ignores other feed changes', () => {
    const events = parseMetaCommentEvents({
      object: 'page',
      entry: [
        {
          id: 'page-1',
          changes: [
            { field: 'feed', value: { item: 'like', verb: 'add' } },
            {
              field: 'feed',
              value: {
                item: 'comment',
                verb: 'add',
                comment_id: 'fb-comment-1',
                post_id: 'fb-post-1',
                message: 'Más información',
                from: { id: 'person-2', name: 'Luis' },
              },
            },
          ],
        },
      ],
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      platform: 'facebook',
      remotePostId: 'fb-post-1',
      remoteCommentId: 'fb-comment-1',
      authorName: 'Luis',
    })
  })
})
