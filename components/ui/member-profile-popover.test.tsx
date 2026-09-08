import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MemberProfilePopover } from './member-profile-popover'

describe('MemberProfilePopover', () => {
  it('shows the member summary and profile link after clicking the avatar', async () => {
    render(
      <MemberProfilePopover
        member={{ id: 'member-1', name: 'Ada Lovelace', avatar_url: null, github_handle: null }}
        avatar={<span>AL</span>}
        profileAvatar={<span>AL</span>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver información de Ada Lovelace' }))

    expect(await screen.findByText('Miembro del equipo')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver perfil' }).getAttribute('href')).toBe(
      '/team/member-1',
    )
  })
})
