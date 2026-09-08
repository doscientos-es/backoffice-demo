'use client'

import HCaptcha from '@hcaptcha/react-hcaptcha'
import { ChevronDown, Eye, EyeOff, LoaderCircle as Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { publicEnv } from '@/lib/env'
import { getBrowserClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'

export function LoginForm() {
  const search = useSearchParams()
  const next = safeNext(search.get('next'))
  const urlError = search.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const hcaptchaRef = useRef<HCaptcha>(null)

  // Stale auth cookies (e.g. session without a team_members row) would loop
  // the user back here forever. Clear them so the next login is clean.
  useEffect(() => {
    if (!urlError || urlError === 'no_session') return
    void getBrowserClient().auth.signOut()
  }, [urlError])

  const displayedError = useMemo(
    () => formError ?? (urlError ? authFailureMessage(urlError) : null),
    [formError, urlError],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (captchaRequired && !captchaToken) {
      setFormError('Por favor, completa el captcha.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/password-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaToken: captchaToken ?? undefined }),
      })
      const result = (await response.json().catch(() => null)) as {
        error?: string
        captchaRequired?: boolean
      } | null
      if (!response.ok) {
        setLoading(false)
        if (result?.captchaRequired) setCaptchaRequired(true)
        setFormError(friendlyError(result?.error ?? ''))
        hcaptchaRef.current?.resetCaptcha()
        return
      }
    } catch {
      setLoading(false)
      setFormError('No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.')
      return
    }
    // Hard navigation (not router.replace + refresh): forces the browser to
    // re-send the freshly-set auth cookies on a real request and bypasses the
    // client Router Cache, which in production could still hold a pre-fetched
    // unauthenticated RSC payload and bounce the user back to /login on the
    // first attempt. Keep loading=true so the button stays in "Entrando…".
    window.location.assign(next)
  }

  // Google OAuth. We do NOT restrict to @doscientos.es (no `hd` param): access
  // is gated by team_members (disable_signup=true), so external collaborators
  // already provisioned can sign in too. The /auth/callback route exchanges the
  // code and honours ?next. signInWithOAuth performs the redirect itself, so we
  // keep googleLoading=true until the browser leaves the page.
  async function onGoogle() {
    setFormError(null)
    setGoogleLoading(true)
    const supabase = getBrowserClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    })
    if (oauthError) {
      setGoogleLoading(false)
      setFormError(friendlyError(oauthError.message))
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        {/* Error messages always visible */}
        {displayedError ? (
          <p
            id="login-error"
            role="alert"
            className={cn(
              'rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs',
              'text-destructive',
            )}
          >
            {displayedError}
          </p>
        ) : null}

        {/* Primary CTA: Google */}
        <Button
          type="button"
          className="w-full"
          onClick={onGoogle}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <GoogleIcon className="h-4 w-4" aria-hidden />
          )}
          Continuar con Google
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-xs text-(--text-muted)">o</span>
          <span className="bg-border h-px flex-1" />
        </div>

        {/* Secondary: email + password (collapsible) */}
        {!showEmailForm ? (
          <Button
            type="button"
            variant="outline"
            className="w-full text-(--text-muted)"
            onClick={() => setShowEmailForm(true)}
            disabled={googleLoading}
          >
            Acceder con email y contraseña
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" aria-hidden />
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email" className="text-xs font-medium">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="tu@doscientos.es"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={displayedError ? true : undefined}
                  aria-describedby={displayedError ? 'login-error' : undefined}
                  disabled={loading}
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="password" className="text-xs font-medium">
                    Contraseña <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Link
                    href="/login/forgot-password"
                    className="hover:text-primary text-xs text-(--text-muted) underline-offset-2 hover:underline"
                    tabIndex={loading ? -1 : 0}
                  >
                    ¿La olvidaste?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={displayedError ? true : undefined}
                    aria-describedby={displayedError ? 'login-error' : undefined}
                    disabled={loading}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    className="hover:text-primary absolute inset-y-0 right-0 flex w-9 items-center justify-center text-(--text-muted) disabled:pointer-events-none"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </Field>
            </FieldGroup>
            {publicEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY && captchaRequired && (
              <div className="flex justify-center">
                <HCaptcha
                  ref={hcaptchaRef}
                  sitekey={publicEnv.NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                />
              </div>
            )}
            <Button type="submit" disabled={loading || googleLoading} className="mt-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Restrict the post-login redirect to same-origin internal paths. Prevents an
 * open redirect now that we navigate with `window.location.assign` (which,
 * unlike `router.replace`, would happily follow an absolute or
 * protocol-relative URL like `//evil.com`).
 */
function safeNext(raw: string | null): string {
  if (!raw?.startsWith('/') || raw.startsWith('//')) return '/inicio'
  return raw
}

function friendlyError(raw: string): string {
  const m = raw.toLowerCase()
  if (m === 'captcha_required') return 'Completa el captcha para continuar.'
  if (m === 'invalid_credentials') return 'Email o contraseña incorrectos.'
  if (m === 'rate_limited') return 'Demasiados intentos. Inténtalo en unos minutos.'
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Tu email aún no está confirmado.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Inténtalo en unos minutos.'
  return raw
}

/**
 * Mirrors the shape of `<LoginForm>` so the Suspense fallback (and any future
 * `loading.tsx`) doesn't cause layout shift while the client form hydrates.
 */
export function LoginFormSkeleton() {
  return (
    <Card aria-hidden>
      <CardContent className="pt-5">
        <div className="flex flex-col gap-4">
          {/* Google button */}
          <Skeleton className="h-9 w-full" />
          {/* Divider */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3 w-4" />
            <Skeleton className="h-px flex-1" />
          </div>
          {/* Email toggle */}
          <Skeleton className="h-9 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

/** Multi-colour Google "G" mark (inline SVG so it keeps its brand colours). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden focusable="false">
      <title>Google</title>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

function authFailureMessage(reason: string): string {
  switch (reason) {
    case 'no_team_member':
      return 'Tu cuenta no está autorizada en este workspace. Contacta con un administrador para que te dé acceso.'
    case 'team_member_deleted':
      return 'Tu acceso ha sido revocado. Contacta con un administrador si crees que es un error.'
    case 'db_error':
      return 'No se pudo verificar tu acceso. Inténtalo de nuevo en unos segundos.'
    case 'forbidden':
      return 'No tienes permisos para esa sección.'
    case 'callback_exchange_failed':
    case 'callback_no_code':
      return 'El enlace ha caducado o ya fue utilizado. Solicita uno nuevo.'
    default:
      // Any other `callback_*` code is a provider-level OAuth error (e.g.
      // Supabase returning "Signups not allowed for oauthproviders" when
      // disable_signup=true and the Google email has no matching auth.users row).
      if (reason.startsWith('callback_')) {
        return 'No se pudo completar el inicio de sesión con Google. Asegúrate de usar el email con el que fuiste invitado, o contacta con un administrador.'
      }
      return 'Sesión expirada. Vuelve a entrar.'
  }
}
