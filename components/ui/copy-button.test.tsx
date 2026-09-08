import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CopyButton } from './copy-button'

describe('CopyButton', () => {
  it('can show a visible copy action without changing its accessible label', () => {
    render(<CopyButton text="Datos fiscales" label="Copiar información fiscal" showLabel />)

    const button = screen.getByRole('button', { name: 'Copiar información fiscal' })
    expect(button.textContent).toContain('Copiar')
    expect(button.className).toContain('gap-1.5')
  })
})
