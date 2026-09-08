import { fireEvent, render, screen } from '@testing-library/react'
import { User } from 'lucide-react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { isNavigationItemActive, NavigationTree } from '@/components/layout/navigation-tree'

vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}))

const groups = [
  {
    label: 'Growth',
    items: [
      { href: '/marketing', label: 'Publicidad', icon: User },
      { href: '/marketing/newsletters', label: 'Newsletters', icon: User },
    ],
  },
]

describe('isNavigationItemActive', () => {
  it('prefers the most specific matching navigation item', () => {
    expect(isNavigationItemActive('/marketing/newsletters', '/marketing', groups)).toBe(false)
    expect(isNavigationItemActive('/marketing/newsletters', '/marketing/newsletters', groups)).toBe(
      true,
    )
  })

  it('keeps a parent active when it has no more specific child', () => {
    expect(isNavigationItemActive('/marketing/campaigns', '/marketing', groups)).toBe(true)
  })

  it('starts navigation sections open and lets users collapse them', () => {
    render(createElement(NavigationTree, { groups, pathname: '/inicio' }))

    expect(screen.getByText('Publicidad')).toBeTruthy()
    expect(screen.getByText('Newsletters')).toBeTruthy()
    const section = screen.getByRole('button', { name: 'Growth' })
    expect(section.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(section)

    expect(screen.queryByText('Publicidad')).toBeNull()
    expect(section.getAttribute('aria-expanded')).toBe('false')
  })
})
