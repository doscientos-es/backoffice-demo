import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STARTUP_SPLASH_SESSION_KEY } from '@/lib/startup-splash'

import { PwaRegister } from './pwa-register'

const register = vi.fn()
const update = vi.fn()

describe('PwaRegister', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    register.mockResolvedValue({ update })
    update.mockResolvedValue(undefined)
    sessionStorage.clear()
    document.body.innerHTML = '<div id="startup-splash"></div>'
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('records the first load and hides the splash as soon as it hydrates', () => {
    render(<PwaRegister />)

    expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' })
    expect(sessionStorage.getItem(STARTUP_SPLASH_SESSION_KEY)).toBe('1')

    expect(document.getElementById('startup-splash')?.classList.contains('is-hidden')).toBe(true)
  })
})
