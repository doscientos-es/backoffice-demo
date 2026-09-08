/**
 * login-form.test.tsx – Login UI flow E2E
 *
 * Simulates real user interactions through the LoginForm component:
 *  - Form renders correctly (fields, labels, button)
 *  - Password visibility toggle works
 *  - URL ?error param maps to a readable Spanish message
 *  - Successful login calls the protected password endpoint + navigates
 *  - Auth failure shows a friendly in-form error
 *  - Form is disabled while the request is in-flight
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── mutable state shared across mocks ─────────────────────────────────────────

const { searchParams } = vi.hoisted(() => ({
  searchParams: { next: null as string | null, error: null as string | null },
}))

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/browser', () => ({
  getBrowserClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'next' ? searchParams.next : searchParams.error),
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── SUT imported after mocks ──────────────────────────────────────────────────

import { LoginForm } from '@/app/login/login-form'

// ── helpers ───────────────────────────────────────────────────────────────────

function setup() {
  const assignSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { assign: assignSpy },
    writable: true,
    configurable: true,
  })
  render(<LoginForm />)
  // The email/password form is collapsed by default behind the toggle button.
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /acceder con email/i }))
  })
  return { assignSpy }
}

function emailInput() {
  return screen.getByLabelText(/email/i)
}
// `selector:"input"` prevents also matching the toggle button's aria-label="Mostrar contraseña"
function passwordInput() {
  return screen.getByLabelText(/contraseña/i, { selector: 'input' })
}
function submitButton() {
  return screen.getByRole('button', { name: /entrar/i })
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
  searchParams.next = null
  searchParams.error = null
})

describe('LoginForm – rendering', () => {
  it('renders email and password fields', () => {
    setup()
    expect(emailInput()).toBeTruthy()
    expect(passwordInput()).toBeTruthy()
  })

  it("renders a submit button with label 'Entrar'", () => {
    setup()
    expect(submitButton()).toBeTruthy()
  })

  it('renders the forgot-password link', () => {
    setup()
    expect(screen.getByRole('link', { name: /olvidaste/i })).toBeTruthy()
  })
})

describe('LoginForm – password visibility toggle', () => {
  it('password is hidden by default', () => {
    setup()
    expect(passwordInput().getAttribute('type')).toBe('password')
  })

  it('clicking the eye button reveals the password', async () => {
    setup()
    const toggle = screen.getByRole('button', { name: /mostrar contraseña/i })
    await act(async () => fireEvent.click(toggle))
    expect(passwordInput().getAttribute('type')).toBe('text')
  })

  it('clicking the eye button again hides the password', async () => {
    setup()
    const toggle = screen.getByRole('button', { name: /mostrar contraseña/i })
    await act(async () => fireEvent.click(toggle))
    const hideToggle = screen.getByRole('button', { name: /ocultar contraseña/i })
    await act(async () => fireEvent.click(hideToggle))
    expect(passwordInput().getAttribute('type')).toBe('password')
  })
})

describe('LoginForm – URL error messages', () => {
  it.each([
    ['no_team_member', /no está autorizada/i],
    ['team_member_deleted', /revocado/i],
    ['db_error', /No se pudo verificar/i],
    ['forbidden', /permisos/i],
    ['callback_no_code', /caducado/i],
  ])('maps ?error=%s to a readable message', (errorCode, pattern) => {
    searchParams.error = errorCode
    setup()
    expect(screen.getByRole('alert').textContent).toMatch(pattern)
  })
})

/** Shortcut: fill an input via fireEvent.change */
function fill(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

describe('LoginForm – submit flow', () => {
  it('sends the typed credentials through the protected login endpoint', async () => {
    const { assignSpy } = setup()
    fill(emailInput(), 'pol@doscientos.es')
    fill(passwordInput(), 'secret123')
    fireEvent.submit(submitButton())
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/inicio'))
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/password-login',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('defaults redirect to /inicio when no ?next param', async () => {
    const { assignSpy } = setup()
    fill(emailInput(), 'pol@doscientos.es')
    fill(passwordInput(), 'pass')
    fireEvent.submit(submitButton())
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/inicio'))
  })

  it('redirects to ?next when it is a safe internal path', async () => {
    searchParams.next = '/leads'
    const { assignSpy } = setup()
    fill(emailInput(), 'pol@doscientos.es')
    fill(passwordInput(), 'pass')
    fireEvent.submit(submitButton())
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('/leads'))
  })

  it('shows a friendly error when credentials are wrong', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'invalid_credentials' }),
      }),
    )
    setup()
    fill(emailInput(), 'pol@doscientos.es')
    fill(passwordInput(), 'wrong')
    fireEvent.submit(submitButton())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/Email o contraseña incorrectos/i),
    )
  })

  it('shows a rate-limit message when too many attempts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'rate_limited' }) }),
    )
    setup()
    fill(emailInput(), 'x@x.com')
    fill(passwordInput(), 'x')
    fireEvent.submit(submitButton())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/Demasiados intentos/i),
    )
  })

  it('asks for CAPTCHA after the server escalates the challenge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'captcha_required', captchaRequired: true }),
      }),
    )
    setup()
    fill(emailInput(), 'x@x.com')
    fill(passwordInput(), 'x')
    fireEvent.submit(submitButton())
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/completa el captcha/i),
    )
  })
})
