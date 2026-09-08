import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CommentCard } from './comment-card'

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('../actions', () => ({
  replyToComment: vi.fn(),
}))

const comment = {
  id: 'comment-1',
  targetId: 'target-1',
  platform: 'instagram' as const,
  remoteCommentId: 'remote-comment-1',
  authorName: 'Ana',
  text: 'Me encanta',
  likeCount: 2,
  replied: false,
  publishedAt: '2026-07-16T10:00:00.000Z',
  postId: 'post-1',
  postCaption:
    'Una caption especialmente larga que debe poder envolver sin romper el ancho de la tarjeta.',
}

describe('CommentCard', () => {
  it('wraps long post context and links back to the originating post', () => {
    render(<CommentCard comment={comment} />)

    const context = screen.getByRole('link', { name: /En post:/i })
    expect(context.getAttribute('href')).toBe('/social/post-1')
    expect(context.className).toContain('min-w-0')
    expect(screen.getByTitle(comment.postCaption).className).toContain('line-clamp-2')
  })

  it('hides the redundant post context when rendered in post detail', () => {
    render(<CommentCard comment={comment} showPostContext={false} />)

    expect(screen.queryByText('En post:')).toBeNull()
  })
})
