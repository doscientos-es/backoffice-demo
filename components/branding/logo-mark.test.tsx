import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LogoMark } from './logo-mark'

describe('LogoMark', () => {
  it('renders both canonical assets in automatic theme mode', () => {
    const { container } = render(<LogoMark />)

    expect(
      Array.from(container.querySelectorAll('img'), (image) => image.getAttribute('src')),
    ).toEqual(['/brand/logo-light.svg', '/brand/logo.svg'])
  })

  it('renders a fixed accessible brand variant', () => {
    render(<LogoMark variant="brand" title="Doscientos" />)

    expect(screen.getByRole('img', { name: 'Doscientos' })).not.toBeNull()
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/brand/logo.svg')
  })
})
