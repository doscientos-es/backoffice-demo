'use client'

import { Eye, EyeOff, LoaderCircle as Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordStrength } from '@/components/ui/password-strength'
import { PASSWORD_MIN_LENGTH, validatePassword } from '@/lib/schemas/password'
import { getBrowserClient } from '@/lib/supabase/browser'

const MIN_LENGTH = PASSWORD_MIN_LENGTH

export function UpdatePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getBrowserClient()
    // getUser() verifies the token against the Supabase Auth server — unlike
    // getSession() / onAuthStateChange session objects which come from storage
    // and may not be authentic.
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user)
      setSessionEmail(data.user?.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // Re-fetch the authenticated user on every auth event instead of
      // trusting the session payload from storage.
      supabase.auth.getUser().then(({ data }) => {
        setHasSession(!!data.user)
        setSessionEmail(data.user?.email ?? null)
      })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const policyError = validatePassword(password)
    if (policyError) {
      setError(policyError)
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    const supabase = getBrowserClient()
    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) {
      setLoading(false)
      setError(authError.message)
      return
    }
    // Hard navigation (not router.replace + refresh): forces the browser to
    // re-send the updated auth cookies on a real request and bypasses the
    // client Router Cache. Keep loading=true so the button stays in "Guardando…".
    window.location.assign('/inicio')
  }

  if (hasSession === false) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-muted text-sm">
            El enlace ha caducado o no es válido.{' '}
            <a
              href="/login/forgot-password"
              className="text-primary font-medium underline-offset-2 hover:underline"
            >
              Solicita uno nuevo
            </a>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-5">
        {sessionEmail ? (
          <p className="text-muted mb-4 text-xs">
            Vas a cambiar la contraseña de{' '}
            <span className="text-primary font-medium">{sessionEmail}</span>. Si no es tu cuenta,
            cierra esta pestaña y solicita un nuevo enlace.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password" className="text-xs font-medium">
                Nueva contraseña <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={MIN_LENGTH}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="password-hint"
                  disabled={loading}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  tabIndex={-1}
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={show}
                  className="text-muted hover:text-primary absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                  disabled={loading}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength value={password} />
              <FieldDescription id="password-hint">
                Mínimo {MIN_LENGTH} caracteres con minúsculas, mayúsculas, números y símbolos.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm" className="text-xs font-medium">
                Confirmar contraseña <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={MIN_LENGTH}
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={
                  error || (confirm.length > 0 && confirm !== password) ? true : undefined
                }
                disabled={loading}
              />
              {confirm.length > 0 && confirm !== password ? (
                <FieldError>Las contraseñas no coinciden.</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
          {error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading || hasSession === null || !password || !confirm}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Guardando…
              </>
            ) : (
              'Actualizar contraseña'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
