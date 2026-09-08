'use client'

import { useMemo, useState, useTransition } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'

import { completeOnboarding, skipOnboarding } from './actions'

interface Props {
  defaultName: string
  email: string
  defaultAvatarUrl: string | null
  defaultGithubHandle: string | null
  defaultEmailAlias: string | null
  defaultPhone: string | null
}

const HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/

export function OnboardingForm({
  defaultName,
  email,
  defaultAvatarUrl,
  defaultGithubHandle,
  defaultEmailAlias,
  defaultPhone,
}: Props) {
  const feedback = useFormFeedback()
  const [skipPending, startSkip] = useTransition()
  const [name, setName] = useState(defaultName)
  const [handle, setHandle] = useState(defaultGithubHandle ?? '')
  const [handleError, setHandleError] = useState<string | null>(null)
  const [aliasError, setAliasError] = useState<string | null>(null)

  // Priority: Google avatar (synced on login) → GitHub avatar from handle → null
  const avatarSrc = useMemo(() => {
    if (defaultAvatarUrl) return defaultAvatarUrl
    const trimmed = handle.trim()
    return HANDLE_RE.test(trimmed) ? `https://github.com/${trimmed}.png?size=200` : undefined
  }, [defaultAvatarUrl, handle])

  const initials = useMemo(() => {
    const source = name.trim() || email
    return source
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [name, email])

  function validateHandle(value: string): string | null {
    const v = value.trim()
    if (!v) return null
    if (v.length > 39) return 'El handle no puede superar 39 caracteres'
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(v))
      return 'Solo letras, números y guiones; debe empezar por letra o número'
    return null
  }

  function validateAlias(value: string): string | null {
    const v = value.trim()
    if (!v) return null
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Introduce un email válido'
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Client-side re-validation so inline errors are visible before the round-trip.
    const hErr = validateHandle(fd.get('github_handle')?.toString() ?? '')
    const aErr = validateAlias(fd.get('email_alias')?.toString() ?? '')
    setHandleError(hErr)
    setAliasError(aErr)
    if (hErr || aErr) return

    feedback.setPending()
    const result = await completeOnboarding(fd)
    if (!result.ok) {
      feedback.setError(result.error)
      return
    }
    feedback.setSuccess('Listo')
    // Hard navigation (not router.replace + refresh): the server action already
    // ran revalidatePath, so a real request re-renders /inicio with the now
    // onboarded state and avoids a client Router Cache race bouncing the user
    // back to /onboarding on the first attempt.
    window.location.assign('/inicio')
  }

  function handleSkip() {
    startSkip(async () => {
      try {
        await skipOnboarding()
      } catch {
        feedback.setError('No se pudo saltar el onboarding. Inténtalo de nuevo.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Avatar size="lg" className="size-14">
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={name || email} referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback>{initials || '·'}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name || 'Sin nombre'}</span>
            <span className="text-muted-foreground text-xs">{email}</span>
            <span className="text-muted-foreground text-[11px]">
              {defaultAvatarUrl
                ? 'Avatar de Google detectado.'
                : avatarSrc
                  ? 'Avatar de GitHub detectado.'
                  : 'Tu avatar se tomará de Google o de tu handle de GitHub.'}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="name" className="text-xs font-medium">
            Nombre completo
          </FieldLabel>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            maxLength={160}
          />
        </Field>
        <Field data-invalid={handleError ? 'true' : undefined}>
          <FieldLabel htmlFor="github_handle" className="text-xs font-medium">
            GitHub handle <span className="text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            id="github_handle"
            name="github_handle"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value)
              if (handleError) setHandleError(validateHandle(e.target.value))
            }}
            onBlur={(e) => setHandleError(validateHandle(e.target.value))}
            placeholder="tu-usuario"
            maxLength={39}
            autoComplete="off"
            aria-invalid={handleError ? true : undefined}
            aria-describedby={handleError ? 'github-handle-error' : 'github-handle-hint'}
          />
          {handleError ? (
            <FieldError id="github-handle-error">{handleError}</FieldError>
          ) : (
            <FieldDescription id="github-handle-hint">
              Sincroniza tus tareas con issues y PRs, y nos da tu avatar.
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={aliasError ? 'true' : undefined}>
          <FieldLabel htmlFor="email_alias" className="text-xs font-medium">
            Alias de envío <span className="text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            id="email_alias"
            name="email_alias"
            type="email"
            inputMode="email"
            defaultValue={defaultEmailAlias ?? ''}
            placeholder="notificaciones@empresa.com"
            autoComplete="email"
            aria-invalid={aliasError ? true : undefined}
            aria-describedby={aliasError ? 'email-alias-error' : 'email-alias-hint'}
            onBlur={(e) => setAliasError(validateAlias(e.target.value))}
            onChange={(e) => {
              if (aliasError) setAliasError(validateAlias(e.target.value))
            }}
          />
          {aliasError ? (
            <FieldError id="email-alias-error">{aliasError}</FieldError>
          ) : (
            <FieldDescription id="email-alias-hint">
              Dirección desde la que se enviarán los emails que mandes a clientes.
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="phone" className="text-xs font-medium">
            Teléfono <span className="text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={defaultPhone ?? ''}
            placeholder="+34 600 000 000"
            maxLength={30}
          />
        </Field>
      </div>

      <div className="border-border flex items-center justify-between gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSkip}
          disabled={skipPending || feedback.pending}
        >
          {skipPending ? 'Saltando…' : 'Saltar por ahora'}
        </Button>
        <div className="flex items-center gap-3">
          <FormFeedback state={feedback.state} successLabel="Listo" />
          <SubmitButton pendingLabel="Guardando…" loading={feedback.pending}>
            Empezar a usar doscientos
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
