import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SectionBoundary } from '@/components/ui/error-boundary'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

function FailingSection(): ReactElement {
  throw new Error('section failed')
}

describe('SectionBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows only its fallback and keeps sibling content rendered', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <div>
        <p>La ficha del lead sigue disponible</p>
        <SectionBoundary label="No se pudieron cargar los diagnósticos">
          <FailingSection />
        </SectionBoundary>
      </div>,
    )

    expect(screen.getByText('La ficha del lead sigue disponible')).toBeDefined()
    expect(screen.getByText('No se pudieron cargar los diagnósticos')).toBeDefined()
  })
})
