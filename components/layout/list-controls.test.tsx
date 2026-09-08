import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  pathname: '/leads',
  params: new URLSearchParams(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}))

import { ListControls } from '@/components/layout/list-controls'

const FILTER = {
  key: 'assignee',
  label: 'Responsable',
  display: 'avatars' as const,
  options: [
    {
      value: 'ana',
      label: 'Ana Pérez',
      avatar: { name: 'Ana Pérez', avatar_url: null, github_handle: null },
    },
  ],
}

const STATUS_FILTER = {
  key: 'status',
  label: 'Estado',
  options: [{ value: 'new', label: 'Nuevo' }],
}

describe('ListControls avatar filter', () => {
  beforeEach(() => {
    navigation.params = new URLSearchParams()
    navigation.replace.mockReset()
    window.localStorage.clear()
  })

  it('selects a member and resets pagination', () => {
    navigation.params = new URLSearchParams('page=2')
    render(<ListControls filters={[FILTER]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por Ana Pérez' }))

    expect(navigation.replace).toHaveBeenCalledWith('/leads?assignee=ana', { scroll: false })
  })

  it('removes the active member filter', () => {
    navigation.params = new URLSearchParams('assignee=ana')
    render(<ListControls filters={[FILTER]} />)

    const button = screen.getByRole('button', { name: 'Quitar filtro de Ana Pérez' })
    expect(button.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(button)

    expect(navigation.replace).toHaveBeenCalledWith('/leads', { scroll: false })
  })

  it('leaves space for the search icon in the default presentation', () => {
    render(<ListControls searchPlaceholder="Buscar leads" />)

    expect(screen.getByPlaceholderText('Buscar leads').className).toContain('pl-10!')
  })

  it('leaves space for the search icon in the panel presentation', () => {
    render(<ListControls searchPlaceholder="Buscar facturas" presentation="panel" />)

    expect(screen.getByPlaceholderText('Buscar facturas').className).toContain('pl-10!')
  })

  it('moves secondary filters into a popover in panel mode', () => {
    navigation.params = new URLSearchParams('status=new')
    render(<ListControls filters={[FILTER, STATUS_FILTER]} presentation="panel" />)

    fireEvent.click(screen.getByRole('button', { name: /filtros 1/i }))

    expect(screen.getByText('Filtrar el listado')).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(navigation.replace).toHaveBeenCalledWith('/leads', { scroll: false })
  })

  it('saves, applies and deletes a browser-local view through URL filters', () => {
    navigation.params = new URLSearchParams('status=new&source=web&page=2')
    render(
      <ListControls
        filters={[STATUS_FILTER]}
        savedViews={{
          storageKey: 'test:lead-views',
          filterKeys: ['q', 'status', 'source'],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Vistas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar filtros actuales' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la vista' }), {
      target: { value: 'Leads nuevos' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(JSON.parse(window.localStorage.getItem('test:lead-views') ?? '[]')).toMatchObject([
      { name: 'Leads nuevos', filters: { status: 'new', source: 'web' } },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Leads nuevos' }))
    expect(navigation.replace).toHaveBeenCalledWith('/leads?status=new&source=web', {
      scroll: false,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar vista Leads nuevos' }))
    expect(JSON.parse(window.localStorage.getItem('test:lead-views') ?? '[]')).toEqual([])
  })
})
