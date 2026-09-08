import { Drawer } from '@doscientos/ui'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

function ControlledDrawer() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Drawer
      trigger={<button type="button">Abrir drawer controlado</button>}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      <p>Contenido controlado</p>
    </Drawer>
  )
}

describe('Drawer', () => {
  it('opens a native-button trigger when its state is controlled', () => {
    render(<ControlledDrawer />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir drawer controlado' }))

    expect(screen.getByText('Contenido controlado')).toBeTruthy()
  })

  it('opens a native-button trigger when it manages its own state', () => {
    render(
      <Drawer trigger={<button type="button">Abrir drawer autónomo</button>}>
        <p>Contenido autónomo</p>
      </Drawer>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Abrir drawer autónomo' }))

    expect(screen.getByText('Contenido autónomo')).toBeTruthy()
  })

  it('preserves the trigger click handler while opening the drawer', () => {
    const onClick = vi.fn()
    render(
      <Drawer
        trigger={
          <button type="button" onClick={onClick}>
            Abrir con acción
          </button>
        }
      >
        <p>Contenido con acción</p>
      </Drawer>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Abrir con acción' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByText('Contenido con acción')).toBeTruthy()
  })
})
