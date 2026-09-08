import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DialogFooter } from '@doscientos/ui'

describe('DialogFooter', () => {
  it('wraps actions that do not fit in its dialog', () => {
    render(
      <DialogFooter>
        <button type="button">Usar código de autenticación</button>
        <button type="button">Usar biometría</button>
      </DialogFooter>,
    )

    expect(screen.getByText('Usar código de autenticación').parentElement?.className).toContain(
      'sm:flex-wrap',
    )
  })
})
