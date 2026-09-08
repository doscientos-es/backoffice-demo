import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mocks } = vi.hoisted(() => ({
  mocks: { runAIObject: vi.fn() },
}))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-model' },
  isAIEnabled: () => true,
  runAIObject: mocks.runAIObject,
}))
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn(async () => ({ id: 'user-1', role: 'member' })) }))
vi.mock('@/lib/leads/company-research', () => ({
  collectCompanySources: vi.fn(async () => [
    { title: 'About us', url: 'https://acme.test', excerpt: 'We build software products.' },
  ]),
  corporateDomainFromEmail: () => 'acme.test',
}))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }))
vi.mock('@/lib/ratelimit', () => ({ rateLimit: () => ({ success: true }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        maybeSingle: async () => ({
          data: {
            id: '00000000-0000-4000-8000-000000000001',
            company: 'Acme',
            email: 'ana@acme.test',
          },
          error: null,
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }
      return query
    },
  })),
}))

import { POST } from './route'

describe('POST /api/crm/ai/research-company', () => {
  beforeEach(() => {
    mocks.runAIObject.mockReset()
    mocks.runAIObject.mockResolvedValue({
      description: 'Acme desarrolla productos de software.',
      sector: 'Tecnología',
      services: [],
      location: null,
      company_size: null,
      fit: 'Podría necesitar desarrollo a medida.',
      priority: 'medium',
      confidence: 0.7,
      reasons: [],
      cautions: [],
    })
  })

  it('instructs the AI to return the research text in Spanish', async () => {
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ lead_id: '00000000-0000-4000-8000-000000000001' }),
      }),
    )

    await response.text()

    expect(mocks.runAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('exclusivamente en español de España'),
      }),
    )
  })
})