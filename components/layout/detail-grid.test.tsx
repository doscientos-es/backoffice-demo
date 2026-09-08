import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'

describe('DetailGrid', () => {
  it('keeps detail values shrinkable and wraps long content', () => {
    const { container } = render(
      <DetailGrid>
        <DetailRow label="Referencia">
          <span>https://example.com/a-very-long-reference</span>
        </DetailRow>
      </DetailGrid>,
    )

    expect(container.querySelector('dl')?.className).toContain('min-w-0')
    expect(container.querySelector('dl')?.className).toContain('grid-cols-[140px_minmax(0,1fr)]')
    expect(
      screen.getByText('https://example.com/a-very-long-reference').closest('dd')?.className,
    ).toContain('wrap-break-word')
  })
})
