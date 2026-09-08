import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskComments } from './task-comments'

const realtime = vi.hoisted(() => {
  const subscribe = vi.fn(() => ({}))
  const on = vi.fn(() => ({ subscribe }))
  return { channel: vi.fn(() => ({ on })), removeChannel: vi.fn() }
})

vi.mock('@/app/(app)/tasks/comment-actions', () => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
}))

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => realtime,
}))

const currentMember = {
  id: 'member-1',
  name: 'Ana Pérez',
  avatar_url: 'https://example.test/ana.png',
  github_handle: null,
}

describe('TaskComments', () => {
  it('renders comments as dated chat bubbles with member avatars', () => {
    render(
      <TaskComments
        taskId="task-1"
        currentMember={currentMember}
        memberRole="member"
        initialComments={[
          {
            id: 'comment-1',
            body: 'Mensaje de otra persona',
            created_at: '2026-08-25T09:30:00.000Z',
            author: {
              id: 'member-2',
              name: 'Luis García',
              avatar_url: 'https://example.test/luis.png',
              github_handle: null,
            },
          },
          {
            id: 'comment-2',
            body: 'Mensaje propio',
            created_at: '2026-08-25T10:00:00.000Z',
            author: currentMember,
          },
        ]}
      />,
    )

    expect(screen.getByRole('list', { name: 'Chat de comentarios' })).toBeTruthy()
    expect(screen.getByText('Mensaje de otra persona').closest('li')?.className).toContain(
      'justify-start',
    )
    expect(screen.getByText('Mensaje propio').closest('li')?.className).toContain('justify-end')
    expect(screen.getByAltText('Luis García')).toBeTruthy()
    expect(screen.getByAltText('Ana Pérez')).toBeTruthy()
    expect(document.querySelectorAll('time[datetime]')).toHaveLength(2)
  })
})
