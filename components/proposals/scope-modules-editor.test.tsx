import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ScopeModule } from '@/lib/proposals/scope'

import { ScopeModulesEditor } from './scope-modules-editor'

const module: ScopeModule = {
  id: 'scope-1',
  title: 'Portal de clientes',
  description: 'Un espacio privado.',
  included: [],
  excluded: [],
  notes: '',
}

function ControlledEditor({ onChange = vi.fn() }: { onChange?: (modules: ScopeModule[]) => void }) {
  const [modules, setModules] = useState([module])
  return (
    <ScopeModulesEditor
      modules={modules}
      onChange={(next) => {
        setModules(next)
        onChange(next)
      }}
    />
  )
}

describe('ScopeModulesEditor', () => {
  it('creates and focuses the next included point when Enter is pressed', () => {
    const onChange = vi.fn()
    render(<ControlledEditor onChange={onChange} />)

    const firstPoint = screen.getByLabelText('Incluido, punto 1')
    fireEvent.change(firstPoint, { target: { value: 'Alta de usuarios' } })
    fireEvent.keyDown(firstPoint, { key: 'Enter' })

    const secondPoint = screen.getByLabelText('Incluido, punto 2')
    expect(document.activeElement).toBe(secondPoint)
    fireEvent.change(secondPoint, { target: { value: 'Gestión de permisos' } })

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ included: ['Alta de usuarios', 'Gestión de permisos'] }),
    ])
  })

  it('keeps included and excluded points separate and removes an empty point with Backspace', () => {
    render(<ControlledEditor />)

    const included = screen.getByLabelText('Incluido, punto 1')
    fireEvent.change(included, { target: { value: 'Configuración' } })
    fireEvent.keyDown(included, { key: 'Enter' })
    const emptyIncluded = screen.getByLabelText('Incluido, punto 2')
    fireEvent.keyDown(emptyIncluded, { key: 'Backspace' })

    expect(screen.queryByLabelText('Incluido, punto 2')).toBeNull()
    expect(screen.getByLabelText('No incluido, punto 1')).toBeDefined()
  })

  it('adds pasted markdown list items to the requested scope column', () => {
    const onChange = vi.fn()
    render(<ControlledEditor onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pegar texto en No incluido' }))
    fireEvent.change(screen.getByLabelText('Texto para añadir a No incluido'), {
      target: { value: '- Migración histórica\n• Integraciones adicionales\n3. Formación' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Convertir texto en puntos de No incluido' }),
    )

    expect((screen.getByLabelText('No incluido, punto 1') as HTMLInputElement).value).toBe(
      'Migración histórica',
    )
    expect((screen.getByLabelText('No incluido, punto 2') as HTMLInputElement).value).toBe(
      'Integraciones adicionales',
    )
    expect((screen.getByLabelText('No incluido, punto 3') as HTMLInputElement).value).toBe(
      'Formación',
    )
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        excluded: ['Migración histórica', 'Integraciones adicionales', 'Formación'],
      }),
    ])
  })

  it('updates the estimated duration of a module', () => {
    const onChange = vi.fn()
    render(<ControlledEditor onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Plazo estimado del módulo 1'), {
      target: { value: '4' },
    })

    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ duration_weeks: 4 })])
  })

  it('accepts a custom duration in the documented format', () => {
    const onChange = vi.fn()
    render(<ControlledEditor onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Plazo estimado del módulo 1'), {
      target: { value: 'custom' },
    })
    fireEvent.change(screen.getByLabelText('Duración personalizada del módulo 1'), {
      target: { value: '3 meses' },
    })

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ duration_mode: 'custom', duration_custom: '3 meses' }),
    ])
  })
})
