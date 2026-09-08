import { describe, expect, it } from 'vitest'

import manifest from './manifest'

describe('PWA manifest', () => {
  it('offers daily shortcuts and accepts shared content into lead intake', () => {
    const result = manifest()

    expect(result.start_url).toBe('/inicio')
    expect(result.shortcuts?.map((shortcut) => shortcut.url)).toEqual([
      '/leads/new',
      '/tasks',
      '/calendar',
    ])
    expect(result.share_target).toMatchObject({
      action: '/share',
      method: 'POST',
      params: { title: 'title', text: 'text', url: 'url' },
    })
  })
})
