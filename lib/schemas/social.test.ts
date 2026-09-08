import { describe, expect, it } from 'vitest'

import { UpdateScheduledPostInput } from './social'

const postId = '11111111-1111-1111-1111-111111111111'
const image = {
  storagePath: 'social/post.jpg',
  publicUrl: 'https://example.com/post.jpg',
  type: 'image',
  mime: 'image/jpeg',
} as const

describe('UpdateScheduledPostInput', () => {
  it('accepts updating the copy, image and scheduled date', () => {
    expect(
      UpdateScheduledPostInput.safeParse({
        postId,
        caption: 'Nuevo copy',
        media: [image],
        scheduledAt: '2026-09-04T08:50:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects an invalid post id and malformed media URL', () => {
    expect(
      UpdateScheduledPostInput.safeParse({
        postId: 'not-a-uuid',
        caption: 'Copy',
        media: [{ ...image, publicUrl: 'not-a-url' }],
        scheduledAt: 'invalid-date',
      }).success,
    ).toBe(false)
  })
})
