import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MemberLabel } from './member-avatar'

describe('MemberLabel', () => {
  it('remains a client boundary so internal callbacks never cross from a Server Component', () => {
    const source = readFileSync(resolve('components/ui/member-avatar.tsx'), 'utf8')

    expect(source.trimStart().startsWith('"use client";')).toBe(true)
  })

  it('opens an assigned member profile without callback props', async () => {
    render(
      <MemberLabel
        member={{ id: 'member-1', name: 'Ada Lovelace', avatar_url: null, github_handle: null }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver información de Ada Lovelace' }))

    expect(await screen.findByText('Miembro del equipo')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver perfil' }).getAttribute('href')).toBe(
      '/team/member-1',
    )
  })

  it('renders an unassigned member without an interactive profile', () => {
    render(<MemberLabel member={null} />)

    expect(screen.getByText('Sin asignar')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
