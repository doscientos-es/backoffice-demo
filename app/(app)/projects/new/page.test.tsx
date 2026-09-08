import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import NewProjectPage from '@/app/(app)/projects/new/page'

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({
    data: [{ id: 'client-123', name: 'Client 123' }],
    error: null,
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(() => Promise.resolve({})),
}))

describe('NewProjectPage pre-fill', () => {
  it('pre-fills client_id from searchParams', async () => {
    const searchParams = Promise.resolve({ client_id: 'client-123' })
    const jsx = await NewProjectPage({ searchParams })
    render(jsx)
    const select = screen.getByLabelText(/cliente/i) as HTMLSelectElement
    expect(select.value).toBe('client-123')
  })

  it('defaults to empty client when searchParams is empty', async () => {
    const searchParams = Promise.resolve({})
    const jsx = await NewProjectPage({ searchParams })
    render(jsx)
    const select = screen.getByLabelText(/cliente/i) as HTMLSelectElement
    expect(select.value).toBe('')
  })
})
