import { describe, expect, it } from 'vitest'

import { externalAppUrl } from './app-url'

describe('externalAppUrl', () => {
  it.each(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000'])(
    'uses the canonical URL instead of the local URL %s',
    (appUrl) => {
      expect(externalAppUrl(appUrl)).toBe('https://app.doscientos.es')
    },
  )

  it('preserves a public URL and removes its trailing slash', () => {
    expect(externalAppUrl('https://staging.example.test/')).toBe('https://staging.example.test')
  })
})
